/** Decorative dashboard preview for hero / marketing sections (no live data). */
export function DashboardMock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/5 ${className}`}
      aria-hidden
    >
      <div className="flex h-[min(420px,70vw)] min-h-[280px] max-h-[440px]">
        <div className="hidden w-14 shrink-0 flex-col gap-2 border-r border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950 sm:flex">
          <span className="h-8 rounded-lg bg-teal-600/90" />
          <span className="h-7 rounded-lg bg-slate-200/90 dark:bg-slate-800" />
          <span className="h-7 rounded-lg bg-slate-200/80 dark:bg-slate-800/80" />
          <span className="h-7 rounded-lg bg-slate-200/80 dark:bg-slate-800/80" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-700" />
              <div className="space-y-1">
                <div className="h-2 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-2 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
            <div className="hidden gap-2 sm:flex">
              <span className="h-8 w-20 rounded-lg bg-slate-100 dark:bg-slate-800" />
              <span className="h-8 w-8 rounded-lg bg-teal-50 ring-1 ring-teal-200 dark:bg-teal-950 dark:ring-teal-800" />
            </div>
          </div>
          <div className="grid flex-1 gap-3 p-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                "bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900",
                "bg-teal-50 ring-teal-100 dark:bg-teal-950/40 dark:ring-teal-900",
                "bg-rose-50 ring-rose-100 dark:bg-rose-950/30 dark:ring-rose-900",
              ].map((c, i) => (
                <div key={i} className={`rounded-xl p-3 ring-1 ${c}`}>
                  <div className="h-2 w-10 rounded bg-white/60 dark:bg-black/20" />
                  <div className="mt-3 h-6 w-16 rounded-md bg-white/80 dark:bg-black/25" />
                  <div className="mt-2 h-2 w-full max-w-[5rem] rounded-full bg-black/5 dark:bg-white/10" />
                </div>
              ))}
            </div>
            <div className="flex min-h-[160px] flex-1 flex-col rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/90 to-white p-3 dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-900">
              <div className="mb-2 flex min-h-[120px] flex-1 items-end gap-1 px-1 pt-2">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-teal-600/90 to-teal-400/70 opacity-90 dark:from-teal-500 dark:to-teal-300/60"
                    style={{ height: `${h}%`, minHeight: "32px" }}
                  />
                ))}
              </div>
              <div className="mt-auto flex justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                <span className="h-2 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
                <span className="h-2 w-12 rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40 dark:ring-white/5" />
    </div>
  );
}
