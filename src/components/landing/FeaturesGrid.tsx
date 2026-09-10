import {
  BarChart3,
  Clock,
  Landmark,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";

const features = [
  {
    icon: Receipt,
    title: "Sales",
    description: "Create invoices, track payments",
  },
  {
    icon: ShoppingCart,
    title: "Purchases",
    description: "Manage bills and vendors",
  },
  {
    icon: Landmark,
    title: "Banking",
    description: "Reconcile accounts easily",
  },
  {
    icon: Wallet,
    title: "Expenses",
    description: "Track all business expenses",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Get real-time insights",
  },
  {
    icon: Clock,
    title: "Time Tracking",
    description: "Monitor work hours",
  },
] as const;

export function FeaturesGrid() {
  return (
    <section
      id="features"
      className="scroll-mt-24 px-4 py-20 sm:px-6 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#0f766e] dark:text-teal-400">
            Modules
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Everything your books need
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            One platform aligned with how you work — from first quote to final payment.
          </p>
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }, i) => (
            <li
              key={title}
              className="group animate-fade-up rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-800/80 dark:hover:shadow-black/30"
              style={{ animationDelay: `${100 + i * 60}ms` }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-[#0f766e] ring-1 ring-teal-100 transition group-hover:scale-105 group-hover:bg-[#0f766e] group-hover:text-white group-hover:ring-[#0f766e] dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900 dark:group-hover:bg-teal-500 dark:group-hover:ring-teal-500">
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
