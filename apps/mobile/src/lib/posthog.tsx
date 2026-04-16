import { PostHogProvider as PHProvider } from "posthog-react-native";
import Constants from "expo-constants";

const POSTHOG_KEY = Constants.expoConfig?.extra?.posthogKey ?? "";
const POSTHOG_HOST = Constants.expoConfig?.extra?.posthogHost ?? "https://us.i.posthog.com";

export function PostHogMobileProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST }}>
      {children}
    </PHProvider>
  );
}
