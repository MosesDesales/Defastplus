import Link from "next/link";

const footerLinks = [
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-12 sm:flex-row sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium">
          {footerLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-slate-600 transition hover:text-[#0f766e] dark:text-slate-400 dark:hover:text-teal-400"
            >
              {label}
            </Link>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 dark:text-slate-500">
          © {new Date().getFullYear()} FASTPLUS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
