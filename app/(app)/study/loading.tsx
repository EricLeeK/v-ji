import { Skeleton } from "@/components/ui/skeleton";

export default function StudyLoading() {
  return (
    <div className="flex flex-1 flex-col bg-[linear-gradient(180deg,#cfe8e1_0%,#f6f8f7_38%)] px-5 pt-6">
      <Skeleton className="h-9 w-full rounded-full" />
      <Skeleton className="mt-6 min-h-[360px] w-full rounded-[28px]" />
      <Skeleton className="mt-auto mb-8 h-12 w-full rounded-full" />
    </div>
  );
}
