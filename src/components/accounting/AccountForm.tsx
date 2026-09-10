"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import type { AccountRow } from "@/components/accounting/ChartOfAccountsClient";

const accountTypeEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);

const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.string().trim().max(40).optional().nullable(),
  autoCode: z.boolean(),
  type: accountTypeEnum,
  parentId: z
    .string()
    .optional()
    .transform((val) => {
      const s = val ?? "";
      return s.trim() === "" ? null : s.trim();
    })
    .pipe(z.union([z.null(), z.string().min(1)])),
  openingBalance: z.coerce.number().finite().min(0).max(999_999_999.9999),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean(),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

const TYPE_LABEL: Record<string, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expenses",
};

/** Map parent account id → direct child account ids */
function groupChildren(rows: { id: string; parentId: string | null }[]) {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const parentKey = r.parentId ?? "__root__";
    if (!m.has(parentKey)) m.set(parentKey, []);
    m.get(parentKey)!.push(r.id);
  }
  return m;
}

function descendantIds(rootId: string, childMap: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  function walk(id: string) {
    for (const c of childMap.get(id) ?? []) {
      out.add(c);
      walk(c);
    }
  }
  walk(rootId);
  return out;
}

export function AccountForm({ accountId }: { accountId?: string }) {
  const router = useRouter();
  const editMode = Boolean(accountId);
  const [allAccounts, setAllAccounts] = useState<AccountRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [meta, setMeta] = useState<{
    transactionCount: number;
    childCount: number;
    isSystem: boolean;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema) as Resolver<AccountFormValues>,
    defaultValues: {
      name: "",
      code: "",
      autoCode: true,
      type: "EXPENSE",
      parentId: null,
      openingBalance: 0,
      description: "",
      isActive: true,
    },
  });

  const type = watch("type");
  const autoCode = watch("autoCode");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/accounting/accounts", { cache: "no-store" });
      const data = (await res.json()) as { accounts?: AccountRow[] };
      if (!cancelled) setAllAccounts(data.accounts ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/accounting/accounts/${accountId}`, { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) setLoadErr("Account not found.");
        return;
      }
      const data = (await res.json()) as {
        account: {
          name: string;
          code: string;
          type: string;
          parentId: string | null;
          openingBalance: number;
          description: string | null;
          isActive: boolean;
          isSystem: boolean;
          transactionCount: number;
          children: { id: string }[];
        };
      };
      if (cancelled) return;
      const a = data.account;
      setMeta({
        transactionCount: a.transactionCount,
        childCount: a.children?.length ?? 0,
        isSystem: a.isSystem,
      });
      reset({
        name: a.name,
        code: a.code,
        autoCode: false,
        type: a.type as AccountFormValues["type"],
        parentId: a.parentId,
        openingBalance: a.openingBalance,
        description: a.description ?? "",
        isActive: a.isActive,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, reset]);

  const parentOptions = useMemo(() => {
    const rows = allAccounts.filter((a) => a.type === type);
    if (!accountId) return rows;
    const map = groupChildren(allAccounts);
    const banned = descendantIds(accountId, map);
    banned.add(accountId);
    return rows.filter((a) => !banned.has(a.id));
  }, [allAccounts, type, accountId]);

  async function onSubmit(values: AccountFormValues) {
    setSaving(true);
    try {
      if (editMode && accountId) {
        const body: Record<string, unknown> = {
          name: values.name,
          type: values.type,
          parentId: values.parentId || null,
          openingBalance: values.openingBalance,
          description: values.description?.trim() || null,
          isActive: values.isActive,
        };
        if (!values.autoCode && values.code?.trim()) body.code = values.code.trim();
        else body.code = values.code?.trim() || null;

        const res = await fetch(`/api/accounting/accounts/${accountId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((j as { error?: string }).error ?? "Could not save.");
          return;
        }
      } else {
        const body = {
          name: values.name,
          code: values.autoCode ? null : values.code?.trim() || null,
          autoCode: values.autoCode,
          type: values.type,
          parentId: values.parentId || null,
          openingBalance: values.openingBalance,
          description: values.description?.trim() || null,
          isActive: values.isActive,
        };
        const res = await fetch("/api/accounting/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((j as { error?: string }).error ?? "Could not create account.");
          return;
        }
      }
      router.push("/dashboard/accounting/chart-of-accounts");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!accountId || !meta || meta.isSystem) return;
    if (!confirm("Delete this account? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/accounting/accounts/${accountId}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((j as { error?: string }).error ?? "Could not delete.");
        return;
      }
      router.push("/dashboard/accounting/chart-of-accounts");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (loadErr) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">{loadErr}</p>
        <Link href="/dashboard/accounting/chart-of-accounts" className="mt-4 inline-block text-teal-600">
          ← Back
        </Link>
      </div>
    );
  }

  const canDelete =
    editMode &&
    meta &&
    !meta.isSystem &&
    meta.transactionCount === 0 &&
    meta.childCount === 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6 px-4 pb-16 sm:px-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard/accounting/chart-of-accounts"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
          >
            ← Chart of accounts
          </Link>
          <div className="flex gap-2">
            {canDelete ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {meta?.isSystem ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This is a system account. Code and core settings may be restricted; posting still uses this account.
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Details</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Account name</label>
            <input
              {...register("name")}
              disabled={meta?.isSystem === true}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {errors.name ? <p className="mt-1 text-sm text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            {!editMode ? (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input type="checkbox" {...register("autoCode")} />
                  Auto-generate code
                </label>
                {!autoCode ? (
                  <>
                    <input
                      {...register("code")}
                      placeholder="e.g. 6100"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    {errors.code ? <p className="mt-1 text-sm text-red-600">{errors.code.message}</p> : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">A unique code is assigned when you save.</p>
                )}
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Account code</label>
                <input
                  {...register("code")}
                  placeholder="e.g. 6100"
                  disabled={meta?.isSystem === true}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                {errors.code ? <p className="mt-1 text-sm text-red-600">{errors.code.message}</p> : null}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Account type</label>
            <select
              {...register("type")}
              disabled={editMode}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white disabled:opacity-70"
            >
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Parent account</label>
            <select
              {...register("parentId")}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">None (top-level)</option>
              {parentOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Opening balance</label>
            <input
              type="number"
              step="0.01"
              {...register("openingBalance")}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input type="checkbox" {...register("isActive")} />
              Active
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              {...register("description")}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
