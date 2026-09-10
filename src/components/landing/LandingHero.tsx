import Link from "next/link";
import { ArrowRight, Shield, Sparkles, Zap } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DashboardMock } from "@/components/landing/DashboardMock";

const pills = [
  { icon: Zap, label: "Fast, modern stack" },
  { icon: Shield, label: "Session-secured" },
  { icon: Sparkles, label: "GST-aware workflows" },
] as const;

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:pb-32 lg:pt-24">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-cyan-50/50 dark:from-slate-950 dark:via-slate-950 dark:to-teal-950/25"
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-32 top-[-10%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-teal-400/25 to-emerald-300/10 blur-3xl dark:from-teal-500/15 dark:to-emerald-500/5" aria-hidden />
      <div className="pointer-events-none absolute -left-24 bottom-[-5%] h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-600/10" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.12]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(15 118 110 / 0.09) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="max-w-xl lg:max-w-none">
          <div className="animate-fade-up inline-flex flex-wrap items-center gap-3">
            <BrandLogo href="/" size="xl" priority />
            <span className="hidden text-xs font-medium text-slate-500 sm:inline dark:text-slate-400">Cloud · Invoices · Ledger</span>
          </div>

          <h1 className="animate-fade-up animate-delay-100 mt-6 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl sm:leading-[1.06] lg:text-[3.35rem] lg:leading-[1.05]">
            Accounting that feels{" "}
            <span className="bg-gradient-to-r from-[#0f766e] via-teal-600 to-emerald-600 bg-clip-text text-transparent dark:from-teal-400 dark:via-teal-300 dark:to-emerald-400">
              effortless
            </span>
            , not overwhelming
          </h1>

          <p className="animate-fade-up animate-delay-200 mt-6 max-w-lg text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Run sales, purchases, banking, and reports from one calm dashboard — built for clarity and speed, with GST
            workflows in mind.{" "}
            <span lang="ar" className="font-medium text-slate-800 dark:text-slate-200">
              بسهولة
            </span>
          </p>

          <ul className="animate-fade-up animate-delay-200 mt-8 flex flex-wrap gap-3">
            {pills.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
              >
                <Icon className="h-3.5 w-3.5 text-[#0f766e] dark:text-teal-400" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <div className="animate-fade-up animate-delay-300 mt-10 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="group inline-flex min-h-[3.25rem] min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0f766e] to-teal-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/25 ring-1 ring-white/10 transition hover:from-[#0d9488] hover:to-teal-500 hover:shadow-xl dark:shadow-teal-950/40"
            >
              Get started free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[3.25rem] min-w-[120px] items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 px-8 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-sm transition hover:border-teal-200 hover:bg-teal-50/50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-white dark:hover:border-teal-700 dark:hover:bg-slate-800"
            >
              Sign in
            </Link>
          </div>
          <p className="animate-fade-up animate-delay-400 mt-8 text-sm text-slate-500 dark:text-slate-500">
            No credit card to explore — sign up and open your dashboard in minutes.
          </p>
        </div>

        <div className="animate-fade-up animate-delay-200 relative lg:justify-self-end">
          <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-teal-500/15 via-transparent to-cyan-400/10 blur-2xl dark:from-teal-400/10" aria-hidden />
          <div className="relative rounded-2xl ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06]">
            <DashboardMock className="relative" />
          </div>
        </div>
      </div>
    </section>
  );
}
