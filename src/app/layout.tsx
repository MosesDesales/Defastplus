import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalAiChat } from "@/components/GlobalAiChat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FASTPLUS",
    template: "%s · FASTPLUS",
  },
  description: "Cloud accounting software for invoicing, expenses, banking, and reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      >
        {children}
        <GlobalAiChat />
      </body>
    </html>
  );
}
