import type { Metadata } from "next";
import { AboutContact } from "@/components/landing/AboutContact";
import { DashboardPreviewSection } from "@/components/landing/DashboardPreviewSection";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { LandingHero } from "@/components/landing/LandingHero";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { Testimonials } from "@/components/landing/Testimonials";
import { WhyChoose } from "@/components/landing/WhyChoose";

export const metadata: Metadata = {
  title: "Cloud accounting for growing businesses",
  description:
    "FAST — invoices, purchases, banking, expenses, reports, and time tracking in one modern dashboard.",
};

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <LandingHero />
      <FeaturesGrid />
      <WhyChoose />
      <DashboardPreviewSection />
      <Testimonials />
      <AboutContact />
      <MarketingFooter />
    </div>
  );
}
