"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DOCUMENT_TEMPLATE_TYPES,
  type DocumentTemplateTypeSlug,
  templateTypeLabel,
} from "@/lib/document-template-types";

function typeFromPath(pathname: string): DocumentTemplateTypeSlug | null {
  const m = pathname.match(/\/(?:dashboard\/)?settings\/templates\/([^/]+)/);
  const seg = m?.[1];
  if (!seg || seg === "templates" || seg === "new") return null;
  return (DOCUMENT_TEMPLATE_TYPES as readonly string[]).includes(seg) ? (seg as DocumentTemplateTypeSlug) : null;
}

export function TemplatesSettingsNav() {
  const pathname = usePathname();
  const active = typeFromPath(pathname);

  return (
    <nav className="w-full shrink-0 lg:w-52" aria-label="Template categories">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Categories</p>
      <ul className="space-y-0.5 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        {DOCUMENT_TEMPLATE_TYPES.map((slug) => {
          const href = `/settings/templates/${slug}`;
          const isActive = active === slug;
          return (
            <li key={slug}>
              <Link
                href={href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-100"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {templateTypeLabel(slug)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
