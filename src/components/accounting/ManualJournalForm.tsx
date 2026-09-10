"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { validateManualJournalLines } from "@/lib/accounting/journal-validate";
import { manualJournalUpsertSchema } from "@/lib/validators";

type AccountOpt = { id: string; code: string; name: string; isActive: boolean };

const journalBodySchema = manualJournalUpsertSchema.omit({ action: true }).superRefine((data, ctx) => {
  const err = validateManualJournalLines(
    data.lines.map((l) => ({ debit: l.debit, credit: l.credit })),
  );
  if (err) {
    ctx.addIssue({ code: "custom", message: err, path: ["lines"] });
  }
  for (let i = 0; i < data.lines.length; i++) {
    if (!data.lines[i].accountId?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Select an account",
        path: ["lines", i, "accountId"],
      });
    }
  }
});

type FormValues = z.infer<typeof journalBodySchema>;

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export function ManualJournalForm({ journalId }: { journalId?: string }) {
  const router = useRouter();
  const editMode = Boolean(journalId);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [submitting, setSubmitting] = useState<"draft" | "post" | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(journalBodySchema) as Resolver<FormValues>,
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      referenceNo: "",
      notes: "",
      lines: [
        { accountId: "", description: "", debit: 0, credit: 0 },
        { accountId: "", description: "", debit: 0, credit: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const lines = watch("lines");
  const totalDebit = useMemo(() => sum(lines.map((l) => Number(l.debit) || 0)), [lines]);
  const totalCredit = useMemo(() => sum(lines.map((l) => Number(l.credit) || 0)), [lines]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/accounting/accounts", { cache: "no-store" });
      const data = (await res.json()) as { accounts?: AccountOpt[] };
      if (!cancelled) {
        setAccounts((data.accounts ?? []).filter((a) => a.isActive !== false));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!journalId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/accounting/journals/${journalId}`, { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) setLoadErr("Journal not found.");
        return;
      }
      const data = (await res.json()) as {
        journal: {
          entryDate: string;
          referenceNo: string | null;
          notes: string | null;
          postingStatus: string;
          lines: Array<{
            accountId: string;
            description: string | null;
            debit: number;
            credit: number;
          }>;
        };
      };
      if (cancelled) return;
      const j = data.journal;
      if (j.postingStatus === "POSTED") setReadOnly(true);
      reset({
        entryDate: j.entryDate.slice(0, 10),
        referenceNo: j.referenceNo ?? "",
        notes: j.notes ?? "",
        lines: j.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description ?? "",
          debit: l.debit,
          credit: l.credit,
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [journalId, reset]);

  async function submit(action: "draft" | "post", values: FormValues) {
    if (readOnly) return;
    setSubmitting(action);
    try {
      const body = {
        entryDate: values.entryDate,
        referenceNo: values.referenceNo?.trim() || null,
        notes: values.notes?.trim() || null,
        lines: values.lines.map((l) => ({
          accountId: l.accountId.trim(),
          description: l.description?.trim() || null,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
        action,
      };

      if (editMode && journalId) {
        const res = await fetch(`/api/accounting/journals/${journalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((j as { error?: string }).error ?? "Could not save journal.");
          return;
        }
      } else {
        const res = await fetch("/api/accounting/journals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((j as { error?: string }).error ?? "Could not create journal.");
          return;
        }
      }
      router.push("/dashboard/accounting/manual-journal");
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  if (loadErr) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-red-600">{loadErr}</p>
        <Link href="/dashboard/accounting/manual-journal" className="mt-4 inline-block text-teal-600">
          ← Manual journals
        </Link>
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard/accounting/manual-journal"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
          >
            ← Manual journals
          </Link>
          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting !== null}
                onClick={handleSubmit((v) => void submit("draft", v))}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {submitting === "draft" ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                disabled={submitting !== null}
                onClick={handleSubmit((v) => void submit("post", v))}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600"
              >
                {submitting === "post" ? "Posting…" : "Post journal"}
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Posted — read only</p>
          )}
        </div>
      </div>

      {readOnly ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          This journal is posted. Create an adjusting entry if you need changes.
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
          <input
            type="date"
            {...register("entryDate")}
            disabled={readOnly}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          {errors.entryDate ? (
            <p className="mt-1 text-sm text-red-600">{String(errors.entryDate.message)}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Reference no.</label>
          <input
            {...register("referenceNo")}
            disabled={readOnly}
            placeholder="Optional — auto if empty"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
          <textarea
            {...register("notes")}
            disabled={readOnly}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-[4.5rem] z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/95">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Line items</span>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => append({ accountId: "", description: "", debit: 0, credit: 0 })}
              className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400"
            >
              + Add row
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Description</th>
                <th className="w-28 px-3 py-3 text-right">Debit</th>
                <th className="w-28 px-3 py-3 text-right">Credit</th>
                {!readOnly ? <th className="w-12 px-2 py-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 align-top">
                    <select
                      {...register(`lines.${index}.accountId`)}
                      disabled={readOnly}
                      className="w-full min-w-[200px] rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">Select account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                    {errors.lines?.[index]?.accountId ? (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.lines[index]?.accountId?.message as string}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      {...register(`lines.${index}.description`)}
                      disabled={readOnly}
                      placeholder="Memo"
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`lines.${index}.debit`, { valueAsNumber: true })}
                      disabled={readOnly}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-right tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`lines.${index}.credit`, { valueAsNumber: true })}
                      disabled={readOnly}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-right tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </td>
                  {!readOnly ? (
                    <td className="px-2 py-2 align-middle">
                      {fields.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {errors.lines && typeof errors.lines.message === "string" ? (
          <p className="border-t border-slate-100 px-4 py-2 text-sm text-red-600 dark:border-slate-800">
            {errors.lines.message}
          </p>
        ) : null}

        <div className="flex justify-end gap-8 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="text-right">
            <span className="text-slate-500">Total debit</span>
            <p className="font-semibold tabular-nums text-slate-900 dark:text-white">{totalDebit.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500">Total credit</span>
            <p className="font-semibold tabular-nums text-slate-900 dark:text-white">{totalCredit.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500">Difference</span>
            <p
              className={
                Math.abs(totalDebit - totalCredit) < 0.005
                  ? "font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                  : "font-semibold tabular-nums text-amber-600 dark:text-amber-400"
              }
            >
              {(totalDebit - totalCredit).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
