import Link from "next/link";

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export type PageToolbarProps = Readonly<{
  title: string;
  subtitle?: string;
  /** Primary action, e.g. "+ New quote" */
  newButton?: { href: string; label: string };
  /** Show Export split-style menu (PDF / Excel stubs until APIs exist) */
  showExport?: boolean;
  /** Optional filter/search slot rendered on the right before export */
  toolbarRight?: React.ReactNode;
}>;

/**
 * Standard module header: title + optional "+ New" + Export dropdown.
 * Pair with {@link DataTableShell} for filters/pagination row.
 */
export function PageToolbar({ title, subtitle, newButton, showExport = true, toolbarRight }: PageToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {toolbarRight}
        {newButton ? (
          <Link
            href={newButton.href}
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
          >
            {newButton.label}
          </Link>
        ) : null}
        {showExport ? (
          <ExportMenu />
        ) : null}
      </div>
    </div>
  );
}

function ExportMenu() {
  return (
    <details className="group relative">
      <summary
        className={cx(
          "cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        Export ▾
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          disabled
          title="PDF export coming soon"
        >
          PDF
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          disabled
          title="Excel export coming soon"
        >
          Excel
        </button>
      </div>
    </details>
  );
}
