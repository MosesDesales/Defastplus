import Link from "next/link";
import { redirect } from "next/navigation";
import { Gstr3bClient } from "@/components/gst/Gstr3bClient";
import { getSession } from "@/lib/session";

export default async function Gstr3bPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link href="/dashboard/gst" className="text-xs font-semibold uppercase text-teal-600 hover:underline dark:text-teal-400">
          ← GST
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">GSTR-3B summary</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Aggregated from invoices (outward) and vendor bills (inward ITC).</p>
      </div>
      <Gstr3bClient />
    </div>
  );
}
