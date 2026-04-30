import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform, Alert } from "react-native";
import { supabase } from "./supabase";
import { isExpoGo } from "./expo-env";

// Setup notification handler (only in dev builds, not Expo Go)
if (!isExpoGo) {
  import("expo-notifications").then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  });
}

// Visible-on-device diagnostics for push registration. Surfaces an Alert
// with a stage tag so we can see exactly where the chain breaks without
// needing logcat access on a release build.
function debugAlert(stage: string, detail?: string) {
  const msg = detail ? `${stage}\n${detail}` : stage;
  console.warn(`[push-register] ${msg}`);
  Alert.alert("Push registration", msg);
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (isExpoGo) {
      debugAlert("skipped: running in Expo Go", "build a dev/demo APK to test push");
      return null;
    }
    if (!Device.isDevice) {
      debugAlert("skipped: not a physical device");
      return null;
    }

    const Notifications = await import("expo-notifications");

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      debugAlert("permission not granted", `final status: ${finalStatus}`);
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      debugAlert("missing projectId", "Constants.expoConfig.extra.eas.projectId is undefined");
      return null;
    }

    let token: string;
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (err) {
      const e = err as Error;
      debugAlert("getExpoPushTokenAsync threw", `${e.name}: ${e.message}`);
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      debugAlert("no auth user", "supabase.auth.getUser() returned null");
      return null;
    }

    const { error } = await supabase.from("push_tokens").upsert(
      { user_id: user.id, token, platform: Platform.OS },
      { onConflict: "token" }
    );
    if (error) {
      debugAlert("upsert failed", `${error.code ?? ""} ${error.message}`);
      return null;
    }

    debugAlert("registered ✓", `token: ${token.slice(0, 28)}…`);
    return token;
  } catch (err) {
    const e = err as Error;
    debugAlert("unexpected error", `${e.name}: ${e.message}`);
    return null;
  }
}

export async function unregisterPushToken(): Promise<void> {
  if (isExpoGo) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  try {
    const Notifications = await import("expo-notifications");
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from("push_tokens").delete().eq("user_id", user.id).eq("token", token);
  } catch {
    // Token cleanup is best-effort
  }
}
