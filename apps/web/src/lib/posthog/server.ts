import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const posthog = getPostHogServer();
  posthog.capture({ distinctId, event, properties });
  await posthog.shutdown();
}
