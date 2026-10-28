import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { csvCell, usersToCsv } from "@/lib/superadmin/csv";
import type { AdminUserDTO } from "@/lib/superadmin/service";

const base: AdminUserDTO = {
  id: "u1",
  email: "owner@example.in",
  name: "Priya Sharma",
  isSuperUser: false,
  isActive: true,
  deactivatedAt: null,
  lastLoginAt: "2026-10-19T04:30:00.000Z",
  createdAt: "2026-04-01T00:00:00.000Z",
  plan: { id: "p1", code: "starter", name: "Starter", isFree: false },
  subscription: {
    status: "ACTIVE",
    storedStatus: "ACTIVE",
    billingInterval: "MONTHLY",
    amount: 499,
    startsAt: "2026-04-01T00:00:00.000Z",
    expiresAt: null,
    trialEndsAt: null,
  },
  moduleAccessRestricted: false,
  assignedModules: [],
  effectiveModules: ["dashboard", "sales_invoices"],
};

describe("user CSV export", () => {
  it("never contains credential fields, even if present on the input object", () => {
    const leaky = { ...base, passwordHash: "$2a$12$secret", sessionVersion: 3, permissions: '["*"]' } as AdminUserDTO;
    const csv = usersToCsv([leaky]);
    assert.ok(!csv.includes("$2a$12$secret"));
    assert.ok(!/password|hash|token|session/i.test(csv));
  });

  it("writes headers, INR amounts and module labels", () => {
    const [header, row] = usersToCsv([base]).replace(/^﻿/, "").trim().split("\r\n");
    assert.match(header!, /"User ID","Email",/);
    assert.match(header!, /Plan Amount \(INR, excl\. GST\)/);
    assert.match(row!, /"owner@example\.in"/);
    assert.match(row!, /"499\.00"/);
    assert.match(row!, /"Dashboard; Sales Invoices \(GST-compliant\)"/);
  });

  it("neutralises spreadsheet formula injection and escapes quotes", () => {
    assert.equal(csvCell("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
    assert.equal(csvCell("+91 98765"), `"'+91 98765"`);
    assert.equal(csvCell("@cmd"), `"'@cmd"`);
    assert.equal(csvCell("plain"), `"plain"`);
  });
});
