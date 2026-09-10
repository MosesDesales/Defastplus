const quotes = [
  {
    quote:
      "We moved our invoicing and receipts into FAST and finally stopped juggling spreadsheets. The dashboard alone saves us hours each month.",
    name: "Priya Sharma",
    role: "Founder, Brightline Studio",
  },
  {
    quote:
      "Clean UI and fast lists — exactly what we needed while we scale. Banking and expenses in one place is a huge win.",
    name: "James Okonkwo",
    role: "Operations Lead, Northwind Trading",
  },
  {
    quote:
      "Reports that actually match how we think about the business. Our accountant loves the export-friendly structure.",
    name: "Elena Rossi",
    role: "Finance Manager, Vesper Co.",
  },
] as const;

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="scroll-mt-24 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50/90 px-4 py-20 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 sm:px-6 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-[#0f766e] dark:text-teal-400 animate-fade-up">
          Social proof
        </p>
        <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl animate-fade-up">
          Used by growing businesses
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600 dark:text-slate-400 animate-fade-up">
          Teams who want Zoho Books–grade clarity without the noise.
        </p>

        <ul className="mt-14 grid gap-6 lg:grid-cols-3">
          {quotes.map(({ quote, name, role }, i) => (
            <li
              key={name}
              className="animate-fade-up rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              style={{ animationDelay: `${150 + i * 100}ms` }}
            >
              <p className="text-slate-700 dark:text-slate-300">&ldquo;{quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-[#0f766e] dark:bg-teal-950 dark:text-teal-300">
                  {name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
