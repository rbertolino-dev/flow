import { Skeleton } from "@/components/ui/skeleton";

const COLUMN_COUNT = 5;
const CARDS_PER_COLUMN = 3;

export function KanbanBoardSkeleton() {
  return (
    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4">
      <div className="flex gap-4 h-full min-w-max">
        {Array.from({ length: COLUMN_COUNT }).map((_, col) => (
          <div
            key={col}
            className="flex flex-col w-72 shrink-0 rounded-lg bg-muted/30 border border-border/50"
          >
            <div className="p-3 border-b border-border/50 flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-hidden">
              {Array.from({ length: CARDS_PER_COLUMN }).map((_, card) => (
                <div
                  key={card}
                  className="rounded-lg border border-border/60 bg-card p-3 space-y-2"
                >
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-1 pt-1">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
