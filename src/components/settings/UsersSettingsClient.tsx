"use client";

import { useCallback, useEffect, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";

type RoleOpt = { id: string; name: string };
type UserRow = { id: string; email: string; name: string; status: string; roleId: string | null; roleName?: string | null };

export function UsersSettingsClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");

  const load = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch("/api/settings/users", { credentials: "include" }),
      fetch("/api/settings/roles", { credentials: "include" }),
    ]);
    const uData = await parseResponseJson<{ users?: UserRow[] }>(uRes, {});
    const rData = await parseResponseJson<{ roles?: Array<{ id: string; name: string }> }>(rRes, {});
    setUsers(uData.users ?? []);
    setRoles((rData.roles ?? []).map((r) => ({ id: r.id, name: r.name })));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), name: name.trim(), roleId: roleId || null }),
    });
    if (!res.ok) alert("Could not add user.");
    else {
      setEmail("");
      setName("");
      void load();
    }
  }

  async function updateStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    await fetch(`/api/settings/users/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={invite} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-white">Invite user</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm">
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm">
            Role
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
          Add to roster
        </button>
        <p className="mt-2 text-xs text-slate-500">Separate login per teammate is not wired — roster + roles are stored for future SSO/email invites.</p>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.roleName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{u.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.status === "ACTIVE" ? (
                    <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => void updateStatus(u.id, "INACTIVE")}>
                      Deactivate
                    </button>
                  ) : (
                    <button type="button" className="text-xs text-teal-600 hover:underline" onClick={() => void updateStatus(u.id, "ACTIVE")}>
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
