"use client";
import Link from "next/link";
import { useUnreadCount } from "@/hooks/queries/use-unread-count";

export function InboxNavLink({ className }: { className: string }) {
  const { data } = useUnreadCount();
  const count = data ?? 0;
  return (
    <Link href="/app/messages" className={`relative ${className}`}>
      Messages
      {count > 0 && (
        <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#BF3328] px-1.5 text-[10px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
