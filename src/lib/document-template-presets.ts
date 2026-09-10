import {
  DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
  type DocumentTemplateConfig,
} from "@/lib/document-template-types";

export type DocumentTemplatePreset = {
  name: string;
  description: string;
  config: DocumentTemplateConfig;
};

function preset(
  name: string,
  description: string,
  overrides: {
    colors: DocumentTemplateConfig["colors"];
    header?: Partial<DocumentTemplateConfig["header"]>;
    party?: Partial<DocumentTemplateConfig["party"]>;
    footer?: Partial<DocumentTemplateConfig["footer"]>;
    typography?: Partial<DocumentTemplateConfig["typography"]>;
  },
): DocumentTemplatePreset {
  return {
    name,
    description,
    config: {
      ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG,
      header: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.header, ...overrides.header },
      party: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.party, ...overrides.party },
      footer: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.footer, ...overrides.footer },
      typography: { ...DEFAULT_DOCUMENT_TEMPLATE_CONFIG.typography, ...overrides.typography },
      colors: overrides.colors,
    },
  };
}

/** Built-in PDF layout presets seeded for each workspace. */
export const DOCUMENT_TEMPLATE_PRESETS: DocumentTemplatePreset[] = [
  preset("Ocean Teal", "Fresh teal accent — great for modern service businesses.", {
    colors: {
      primary: "#0f766e",
      headerBg: "#f0fdfa",
      tableHeaderBg: "#ccfbf1",
      tableBorder: "#99f6e4",
    },
  }),
  preset("Midnight Navy", "Deep navy header with crisp white body — classic corporate.", {
    colors: {
      primary: "#1e3a8a",
      headerBg: "#eff6ff",
      tableHeaderBg: "#dbeafe",
      tableBorder: "#bfdbfe",
    },
    header: { alignment: "left", fontSizePt: 12 },
  }),
  preset("Classic Minimal", "Black-and-white layout with strong typography.", {
    colors: {
      primary: "#18181b",
      headerBg: "#fafafa",
      tableHeaderBg: "#f4f4f5",
      tableBorder: "#e4e4e7",
    },
    header: { alignment: "left", fontSizePt: 11 },
    typography: { bodyFontSizePt: 9, headingFont: "Helvetica-Bold", bodyFont: "Helvetica" },
  }),
  preset("Royal Violet", "Rich purple tones for premium brands.", {
    colors: {
      primary: "#6d28d9",
      headerBg: "#f5f3ff",
      tableHeaderBg: "#ede9fe",
      tableBorder: "#ddd6fe",
    },
    header: { alignment: "center", fontSizePt: 12 },
    party: { label: "Bill To" },
  }),
  preset("Coral Sunset", "Warm coral accent — friendly and approachable.", {
    colors: {
      primary: "#ea580c",
      headerBg: "#fff7ed",
      tableHeaderBg: "#ffedd5",
      tableBorder: "#fed7aa",
    },
    footer: {
      notes: "Thank you for your business.",
      terms: "Payment is due within the agreed credit period.",
      signatureLabel: "Authorized Signatory",
      showNotes: true,
      showTerms: true,
      showSignature: true,
    },
  }),
  preset("Forest Ledger", "Earthy green palette suited to retail and agriculture.", {
    colors: {
      primary: "#15803d",
      headerBg: "#f0fdf4",
      tableHeaderBg: "#dcfce7",
      tableBorder: "#bbf7d0",
    },
    party: { label: "Customer" },
  }),
  preset("Slate Corporate", "Cool grey-blue professional layout.", {
    colors: {
      primary: "#334155",
      headerBg: "#f8fafc",
      tableHeaderBg: "#e2e8f0",
      tableBorder: "#cbd5e1",
    },
    header: { alignment: "right", fontSizePt: 11 },
    typography: { bodyFontSizePt: 8.5, headingFont: "Helvetica-Bold", bodyFont: "Helvetica" },
  }),
  preset("Indigo Pro", "Bold indigo with centered header — ideal for tech firms.", {
    colors: {
      primary: "#4338ca",
      headerBg: "#eef2ff",
      tableHeaderBg: "#e0e7ff",
      tableBorder: "#c7d2fe",
    },
    header: { alignment: "center", fontSizePt: 13 },
  }),
  preset("Golden Executive", "Refined gold accent for high-value invoices.", {
    colors: {
      primary: "#b45309",
      headerBg: "#fffbeb",
      tableHeaderBg: "#fef3c7",
      tableBorder: "#fde68a",
    },
    header: { alignment: "left", fontSizePt: 12 },
    footer: {
      notes: "",
      terms: "Kindly remit payment by the due date shown above.",
      signatureLabel: "For & on behalf of",
      showNotes: true,
      showTerms: true,
      showSignature: true,
    },
  }),
];

export const DOCUMENT_TEMPLATE_PRESET_NAMES = DOCUMENT_TEMPLATE_PRESETS.map((p) => p.name);

export const DOCUMENT_TEMPLATE_PRESET_DESCRIPTIONS = Object.fromEntries(
  DOCUMENT_TEMPLATE_PRESETS.map((p) => [p.name, p.description]),
) as Record<string, string>;
