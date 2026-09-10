import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "pdfkit", "pdf-parse", "sharp", "xlsx", "@cursor/sdk"],
  async rewrites() {
    return [
      { source: "/integrations/:path*", destination: "/dashboard/integrations/:path*" },
      { source: "/settings/currencies", destination: "/dashboard/settings/currencies" },
      { source: "/settings/profile", destination: "/dashboard/settings/profile" },
      { source: "/settings/general", destination: "/dashboard/settings/general" },
      { source: "/settings/templates", destination: "/dashboard/settings/templates" },
      { source: "/settings/templates/:path*", destination: "/dashboard/settings/templates/:path*" },
      { source: "/banking", destination: "/dashboard/banking" },
      { source: "/banking/:path*", destination: "/dashboard/banking/:path*" },
      { source: "/time-tracking", destination: "/dashboard/time-tracking" },
      { source: "/time-tracking/:path*", destination: "/dashboard/time-tracking/:path*" },
      { source: "/tasks", destination: "/dashboard/tasks" },
      { source: "/tasks/:path*", destination: "/dashboard/tasks/:path*" },
      { source: "/api/currencies", destination: "/api/settings/currencies" },
      { source: "/api/currencies/:path*", destination: "/api/settings/currencies/:path*" },
      { source: "/api/journals/:path*", destination: "/api/accounting/journals/:path*" },
      { source: "/api/recurring-invoices", destination: "/api/sales/recurring-invoices" },
      { source: "/api/recurring-invoices/:path*", destination: "/api/sales/recurring-invoices/:path*" },
      { source: "/api/credit-notes", destination: "/api/sales/credit-notes" },
      { source: "/api/credit-notes/:path*", destination: "/api/sales/credit-notes/:path*" },
    ];
  },
};

export default nextConfig;
