import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { MODULES_AFTER_PURCHASES } from "@/lib/dashboard-nav";

const meta = MODULES_AFTER_PURCHASES.find((m) => m.href === "/dashboard/documents")!;

export default function DocumentsPage() {
  return <ModulePlaceholder title={meta.label} description={meta.description} />;
}
