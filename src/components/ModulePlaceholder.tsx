export function ModulePlaceholder({
  title,
  description,
  hint,
}: Readonly<{
  title: string;
  description: string;
  hint?: string;
}>) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-10 text-center dark:border-slate-700 dark:bg-slate-900/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
          Module preview
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>
        {hint ? (
          <p className="mx-auto mt-5 max-w-lg rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950/80 dark:text-slate-400">
            {hint}
          </p>
        ) : null}
        <span className="mt-8 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Coming soon — data model and workflows hook up here
        </span>
      </div>
    </div>
  );
}
