import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy practices for FAST.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#0f766e] dark:text-teal-400">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Privacy Policy</h1>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

      <div className="mt-10 space-y-4 text-slate-600 dark:text-slate-400">
        <p>
          FAST (&quot;we&quot;, &quot;our&quot;) respects your privacy. This policy describes how we handle
          information when you use our website and services.
        </p>
        <h2 className="mt-10 text-xl font-semibold text-slate-900 dark:text-white">Information we collect</h2>
        <p>
          We collect account details you provide (such as name and email), authentication session data necessary to keep you
          signed in securely, and business data you enter into the product (for example invoices and transactions).
        </p>
        <h2 className="mt-10 text-xl font-semibold text-slate-900 dark:text-white">How we use information</h2>
        <p>
          We use this information to operate the service, improve reliability and security, and communicate with you about your
          account where appropriate.
        </p>
        <h2 className="mt-10 text-xl font-semibold text-slate-900 dark:text-white">Contact</h2>
        <p>
          Questions about privacy? Reach us at{" "}
          <a href="mailto:support@fast.example" className="font-medium text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-400">
            support@fast.example
          </a>
          .
        </p>
      </div>

      <p className="mt-12">
        <Link href="/" className="text-sm font-medium text-[#0f766e] hover:underline dark:text-teal-400">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
