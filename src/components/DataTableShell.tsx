/**
 * Table list chrome: optional filters row + bordered table container + record count.
 * Server-side sorting, filtering, and pagination should use URL search params and `router.refresh()` later.
 */
export function DataTableShell({
  filterSlot,
  totalRows,
  children,
}: Readonly<{
  filterSlot?: React.ReactNode;
  totalRows: number;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">{filterSlot}</div>
        <p className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
          {totalRows} record{totalRows === 1 ? "" : "s"}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}
