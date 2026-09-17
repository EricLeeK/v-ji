import { Skeleton } from "@/components/ui/skeleton";

export function AppSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-5 pt-6">
      <Skeleton className="h-8 w-28 rounded-full" />
      <Skeleton className="mt-5 h-44 w-full rounded-[28px]" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
      <Skeleton className="mt-4 h-16 w-full rounded-3xl" />
      <Skeleton className="mt-3 h-16 w-full rounded-3xl" />
    </div>
  );
}
