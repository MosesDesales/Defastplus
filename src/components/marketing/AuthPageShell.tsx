import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const highlights = [
  "Invoices, purchases, and GST in one flow",
  "Ledger-backed reports you can trust",
  "Responsive dashboard — work from anywhere",
];

export function AuthPageShell({
  children,
  variant,
}: Readonly<{
  children: ReactNode;
  /** "signin" | "signup" — tweaks headline copy */
  variant: "signin" | "signup";
}>) {
  const headline =
    variant === "signin" ? "Welcome back to your workspace." : "Start your books on the right foot.";
  const sub =
    variant === "signin"
      ? "Pick up where you left off — balances, drafts, and reports stay in sync."
      : "Create your organization and explore sales, purchases, and accounting in minutes.";

  return (
    <div className="min-h-[calc(100vh-5.5rem)] lg:min-h-[calc(100vh-6rem)] lg:grid lg:grid-cols-[minmax(280px,1fr)_minmax(320px,520px)]">
      {/* Left / brand panel — desktop */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-teal-700 to-slate-900" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-soft-light"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl" aria-hidden />

        <div className="relative z-10 flex flex-1 flex-col p-10 xl:p-14">
          <BrandLogo size="lg" panel />

          <div className="mt-auto max-w-md pt-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200/90">Cloud accounting</p>
            <h2 className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight text-white xl:text-4xl">{headline}</h2>
            <p className="mt-4 text-base leading-relaxed text-teal-50/90">{sub}</p>
            <ul className="mt-10 space-y-3.5">
              {highlights.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-white/95">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" strokeWidth={2} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative z-10 mt-12 text-xs text-teal-200/70">Secure session · Encrypted in transit</p>
        </div>
      </aside>

      {/* Form column */}
      <main className="relative flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-teal-50/30 px-4 py-10 sm:px-6 sm:py-14 dark:from-slate-950 dark:via-slate-950 dark:to-teal-950/20">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(15 118 110 / 0.07) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <BrandLogo size="md" className="mx-auto" />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{headline}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
