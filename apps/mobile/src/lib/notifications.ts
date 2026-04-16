import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import { isExpoGo } from "./expo-env";

// Setup notification handler (only in dev builds, not Expo Go)
if (!isExpoGo) {
  import("expo-notifications").then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) return null;
  if (!Device.isDevice) { console.warn("Push notifications require a physical device"); return null; }

  const Notifications = await import("expo-notifications");

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Default", importance: Notifications.AndroidImportance.MAX });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("push_tokens").upsert(
      { user_id: user.id, token, platform: Platform.OS },
      { onConflict: "token" }
    );
  }
  return token;
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
