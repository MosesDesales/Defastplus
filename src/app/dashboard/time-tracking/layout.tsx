import type { ReactNode } from "react";
import { TimeTrackingSubnav } from "@/components/time-tracking/TimeTrackingSubnav";

export default function TimeTrackingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <TimeTrackingSubnav />
      {children}
    </div>
  );
}
