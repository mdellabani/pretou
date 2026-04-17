import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <ListSkeleton rows={3} />
        <Skeleton className="h-6 w-32" />
        <ListSkeleton rows={2} />
        <Skeleton className="h-6 w-32" />
        <ListSkeleton rows={2} />
      </div>
    </div>
  );
}
