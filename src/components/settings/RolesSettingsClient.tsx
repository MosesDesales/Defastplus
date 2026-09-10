"use client";

import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

const MODULE_OPTS = ["dashboard", "sales", "purchases", "inventory", "reports", "accounting", "payroll", "hr", "gst", "settings"];

export function RolesSettingsClient() {
  const [roles, setRoles] = useState<Array<{ id: string; name: string; slug: string; isSystem: boolean; permissions: unknown }>>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [perms, setPerms] = useState<string[]>(["dashboard.view", "sales.view"]);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/roles", { credentials: "include" });
    const data = await parseResponseJson<{ roles?: typeof roles }>(res, {});
    setRoles(data.roles ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleMod(mod: string, action: string) {
    const key = `${mod}.${action}`;
    setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/roles", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), slug: slug.trim(), permissions: perms }),
    });
    if (!res.ok) alert("Could not create role.");
    else {
      setName("");
      setSlug("");
      void load();
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={createRole} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-white">Create custom role</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm">
            Slug
            <input required value={slug} onChange={(e) => setSlug(e.target.value.replace(/\s+/g, "-").toLowerCase())} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Permissions (matrix)</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                  <th className="px-2 py-2 text-left">Module</th>
                  <th className="px-2 py-2">View</th>
                  <th className="px-2 py-2">Create</th>
                  <th className="px-2 py-2">Edit</th>
                  <th className="px-2 py-2">Delete</th>
                </tr>
              </thead>
              <tbody>
                {MODULE_OPTS.map((mod) => (
                  <tr key={mod} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-2 capitalize">{mod}</td>
                    {(["view", "create", "edit", "delete"] as const).map((action) => (
                      <td key={action} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={perms.includes(`${mod}.${action}`)}
                          onChange={() => toggleMod(mod, action)}
                          className="rounded border-slate-300"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Use wildcard presets from seeded roles (e.g. Accounting) or combine checks above.</p>
        </div>
        <button type="submit" className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
          Save role
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">System</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.slug}</td>
                <td className="px-4 py-3">{r.isSystem ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
