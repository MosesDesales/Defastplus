"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthPageShell } from "@/components/marketing/AuthPageShell";

const inputClass =
  "w-full rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-3 text-slate-900 shadow-sm outline-none ring-teal-600/15 transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 dark:border-slate-600 dark:bg-slate-950/80 dark:text-white dark:focus:border-teal-500";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string; redirectTo?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not sign in");
        return;
      }
      router.push(data.redirectTo === "/superadmin" ? "/superadmin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell variant="signin">
      <AuthCard
        hideLogo
        title="Welcome back"
        subtitle="Sign in to invoices, ledger, and reports."
        footer={
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-400">
              Create one free
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error ? (
            <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#0f766e] to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 ring-1 ring-white/10 transition hover:from-[#0d9488] hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-55 dark:shadow-teal-950/30"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </AuthCard>
    </AuthPageShell>
  );
}
