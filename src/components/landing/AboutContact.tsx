import Link from "next/link";

export function AboutContact() {
  return (
    <>
      <section id="about" className="scroll-mt-24 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">About FAST</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            We&apos;re building cloud accounting that feels as polished as leading SaaS books products — invoices, purchases,
            banking, expenses, and reporting in one cohesive experience. Start simple; scale as your workflows grow.
          </p>
        </div>
      </section>

      <section
        id="contact"
        className="scroll-mt-24 border-t border-slate-100 bg-slate-50/70 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/40 sm:px-6"
      >
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Contact</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Questions about rollout, partnerships, or enterprise plans?{" "}
            <Link
              href="mailto:support@fast.example"
              className="font-semibold text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-400"
            >
              support@fast.example
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
