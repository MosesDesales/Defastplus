"use client";

export type SalaryComponentRow = {
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amountType: "FLAT" | "PERCENT_OF_BASIC";
  amount: string;
  percentOfBasic: string;
};

export function emptyComponentRow(): SalaryComponentRow {
  return { name: "", kind: "EARNING", amountType: "FLAT", amount: "0", percentOfBasic: "" };
}

/** Add/edit/remove salary component rows. Purely controlled — parent owns state and persistence. */
export function SalaryComponentEditor({
  rows,
  onChange,
}: {
  rows: SalaryComponentRow[];
  onChange: (rows: SalaryComponentRow[]) => void;
}) {
  function update(i: number, patch: Partial<SalaryComponentRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...rows, emptyComponentRow()]);
  }

  const inputCls = "w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950";

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Basis</th>
              <th className="px-3 py-2">Amount / %</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2">
                  <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className={inputCls} placeholder="e.g. Basic" />
                </td>
                <td className="px-3 py-2">
                  <select value={r.kind} onChange={(e) => update(i, { kind: e.target.value as SalaryComponentRow["kind"] })} className={inputCls}>
                    <option value="EARNING">Earning</option>
                    <option value="DEDUCTION">Deduction</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={r.amountType}
                    onChange={(e) => update(i, { amountType: e.target.value as SalaryComponentRow["amountType"] })}
                    className={inputCls}
                  >
                    <option value="FLAT">Flat amount</option>
                    <option value="PERCENT_OF_BASIC">% of Basic</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {r.amountType === "FLAT" ? (
                    <input type="number" step="0.01" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} className={inputCls} />
                  ) : (
                    <input type="number" step="0.01" value={r.percentOfBasic} onChange={(e) => update(i, { percentOfBasic: e.target.value })} className={inputCls} placeholder="%" />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => remove(i)} className="text-xs text-red-600 hover:underline dark:text-red-400">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
        + Add component
      </button>
    </div>
  );
}
