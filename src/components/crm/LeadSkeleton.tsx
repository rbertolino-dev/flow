import { Skeleton } from "@/components/ui/skeleton";
import { TableRow, TableCell } from "@/components/ui/table";

export function LeadSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24 mt-2" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36 mt-2" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8 ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

