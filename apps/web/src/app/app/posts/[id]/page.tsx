import { PostDetailClient } from "./post-detail-client";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetailClient postId={id} />;
}
