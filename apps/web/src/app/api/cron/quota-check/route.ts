import { NextRequest, NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { AnalyticsEvents, type QuotaUsage } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage: QuotaUsage["metrics"] = [];

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/usage`,
        {
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const metric of data) {
            usage.push({
              name: `supabase_${metric.metric}`,
              current: metric.usage ?? 0,
              limit: metric.limit ?? 0,
              percentage: metric.limit ? Math.round((metric.usage / metric.limit) * 100) : 0,
              unit: metric.unit ?? "count",
            });
          }
        }
      }
    } catch (err) {
      console.error("Supabase quota check failed:", err);
    }
  }

  if (usage.length > 0) {
    const quotaData: QuotaUsage = {
      provider: "supabase",
      metrics: usage,
      timestamp: new Date().toISOString(),
    };

    await captureServerEvent("system", AnalyticsEvents.QUOTA_CHECK, {
      ...quotaData,
      alert: usage.some((m) => m.percentage > 80),
    });
  }

  return NextResponse.json({
    ok: true,
    metrics: usage.length,
    alert: usage.some((m) => m.percentage > 80),
  });
}
