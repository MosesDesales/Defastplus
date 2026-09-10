import { Cloud, Gauge, Lock, Sparkles } from "lucide-react";

const reasons = [
  {
    icon: Sparkles,
    title: "Simple UI",
    text: "Clean layouts inspired by tools like Zoho Books — less clutter, faster work.",
  },
  {
    icon: Gauge,
    title: "Fast performance",
    text: "Built on a modern stack so lists, reports, and dashboards stay snappy.",
  },
  {
    icon: Lock,
    title: "Secure data",
    text: "Session-based auth and careful handling of your business records.",
  },
  {
    icon: Cloud,
    title: "Cloud-based access",
    text: "Sign in from anywhere — desktop or mobile-friendly responsive screens.",
  },
] as const;

export function WhyChoose() {
  return (
    <section
      id="why-us"
      className="scroll-mt-24 border-y border-slate-100 bg-slate-50/80 px-4 py-20 dark:border-slate-800 dark:bg-slate-900/50 sm:px-6 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Why choose FAST?
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Built for owners and accountants who want clarity without compromise.
          </p>
        </div>

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className="animate-fade-up rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <Icon className="h-8 w-8 text-[#0f766e] dark:text-teal-400" strokeWidth={1.5} aria-hidden />
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
