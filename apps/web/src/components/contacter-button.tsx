"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversationAction } from "@/app/app/messages/actions";

export function ContacterButton(props: {
  postId: string;
  postType: string;
  authorId: string;
  viewerId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (props.postType === "annonce") return null;
  if (props.viewerId === props.authorId) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const conv = await startConversationAction({
            postId: props.postId,
            otherUserId: props.authorId,
          });
          router.push(`/app/messages/${conv.id}`);
        })
      }
      className="rounded-md border border-[#D35230] bg-white px-3 py-1.5 text-sm font-medium text-[#BF3328] hover:bg-[#FDF0EB] disabled:opacity-50"
    >
      Contacter
    </button>
  );
}
