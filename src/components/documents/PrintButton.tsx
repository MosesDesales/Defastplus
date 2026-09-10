"use client";

export function PrintButton({ label = "Print" }: Readonly<{ label?: string }>) {
  return (
    <button type="button" className="text-sm font-medium text-teal-700 hover:underline" onClick={() => window.print()}>
      {label}
    </button>
  );
}
