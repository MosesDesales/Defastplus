"use client";

import { useEffect } from "react";

/** Scrolls to `#…` targets after client navigation (e.g. from header Settings). */
export function ProfileSettingsAnchorScroll() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return null;
}
