import { DashboardMock } from "@/components/landing/DashboardMock";

export function DashboardPreviewSection() {
  return (
    <section
      id="dashboard-preview"
      className="scroll-mt-24 px-4 py-20 sm:px-6 lg:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="animate-fade-up max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#0f766e] dark:text-teal-400">
            Dashboard
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Everything you need in one dashboard
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            See sales, cash flow, receivables, and recent activity at a glance — so you always know where the business stands.
          </p>
        </div>
        <div className="animate-fade-up animate-delay-200">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}
