import { TaxesSettingsNav } from "@/components/settings/TaxesSettingsNav";

export default function TaxesSettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:gap-10">
      <TaxesSettingsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
