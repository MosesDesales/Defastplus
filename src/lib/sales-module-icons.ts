import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  FileMinus,
  FileText,
  Link2,
  Receipt,
  Repeat,
  Truck,
  Users,
} from "lucide-react";
import type { SalesSlug } from "@/lib/dashboard-nav";

export const SALES_MODULE_ICONS: Record<SalesSlug, LucideIcon> = {
  customers: Users,
  quotes: FileText,
  invoices: Receipt,
  "payments-received": CreditCard,
  "recurring-invoices": Repeat,
  "credit-notes": FileMinus,
  "delivery-challans": Truck,
  "payment-links": Link2,
};
