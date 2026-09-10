/** Top-right Settings menu: organization + module groups (matches product IA). */

export type SettingsMenuItem = {
  label: string;
  href: string;
};

export type SettingsMenuGroup = {
  id: string;
  label: string;
  items: SettingsMenuItem[];
};

export type SettingsMenuSection = {
  id: string;
  title: string;
  groups: SettingsMenuGroup[];
};

export type SettingsMenuFlatSection = {
  id: string;
  title: string;
  items: SettingsMenuItem[];
};

function upcoming(key: string): string {
  return `/dashboard/settings/upcoming?k=${encodeURIComponent(key)}`;
}

export const SETTINGS_ORGANIZATION_SECTION: SettingsMenuSection = {
  id: "organization",
  title: "Organization settings",
  groups: [
      {
        id: "org-organization",
        label: "Organization",
        items: [
          { label: "Profile", href: "/settings/profile" },
          { label: "Branding", href: "/settings/profile#settings-branding" },
          { label: "Custom Domain", href: upcoming("custom-domain") },
          { label: "Locations", href: upcoming("locations") },
          { label: "AI Preferences", href: upcoming("ai-preferences") },
          { label: "Manage Subscription", href: upcoming("subscription") },
        ],
      },
      {
        id: "org-users-roles",
        label: "Users & Roles",
        items: [
          { label: "Users", href: "/dashboard/settings/users" },
          { label: "Roles", href: "/dashboard/settings/roles" },
          { label: "User Preferences", href: "/settings/profile#settings-user-account" },
        ],
      },
      {
        id: "org-taxes",
        label: "Taxes & Compliance",
        items: [
          { label: "Taxes", href: "/dashboard/settings/taxes/gst" },
          { label: "Direct Taxes", href: "/dashboard/gst/gstr-3b" },
          { label: "MSME Settings", href: upcoming("msme-settings") },
        ],
      },
      {
        id: "org-setup",
        label: "Setup & Configurations",
        items: [
          { label: "General", href: "/settings/general" },
          { label: "Currencies", href: "/settings/currencies" },
          { label: "Opening Balances", href: upcoming("opening-balances") },
          { label: "Reminders", href: upcoming("reminders") },
          { label: "Customer Portal", href: upcoming("customer-portal") },
          { label: "Vendor Portal", href: upcoming("vendor-portal") },
        ],
      },
      {
        id: "org-customization",
        label: "Customization",
        items: [
          { label: "Transaction Number Series", href: upcoming("txn-number-series") },
          { label: "PDF Templates", href: "/settings/templates" },
          { label: "Email Notifications", href: upcoming("email-notifications") },
          { label: "SMS Notifications", href: upcoming("sms-notifications") },
          { label: "Reporting Tags", href: upcoming("reporting-tags") },
          { label: "Web Tabs", href: upcoming("web-tabs") },
          { label: "Digital Signature", href: upcoming("digital-signature") },
        ],
      },
      {
        id: "org-automation",
        label: "Automation",
        items: [
          { label: "Workflow Rules", href: upcoming("workflow-rules") },
          { label: "Workflow Actions", href: upcoming("workflow-actions") },
          { label: "Workflow Logs", href: upcoming("workflow-logs") },
          { label: "Schedules", href: upcoming("schedules") },
        ],
      },
    ],
};

/** Top-level module shortcuts (reference: Module settings list). */
export const SETTINGS_MODULE_SECTION: SettingsMenuFlatSection = {
  id: "modules",
  title: "Module settings",
  items: [
    { label: "General", href: "/dashboard/settings" },
    { label: "Inventory", href: "/dashboard/inventory" },
    { label: "Online Payments", href: "/dashboard/banking" },
    { label: "Sales", href: "/dashboard/sales" },
    { label: "Purchases", href: "/dashboard/purchases" },
    { label: "Custom Modules", href: upcoming("custom-modules") },
  ],
};

export function itemBasePath(href: string): string {
  return href.split("#")[0].split("?")[0];
}

export function itemHash(href: string): string | null {
  const i = href.indexOf("#");
  if (i === -1) return null;
  return href.slice(i);
}
