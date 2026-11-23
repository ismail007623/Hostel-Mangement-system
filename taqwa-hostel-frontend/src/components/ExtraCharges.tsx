/* Extra charges (AC / Cooler / Geyser / custom) — admin UI.
   RULE shown here: monthly total = base rent + ACTIVE extras.
   A change applies from the NEXT rent cycle, never to a cycle
   that already exists. Amounts are typed in by the admin — none
   are hardcoded. */

"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, formatRs } from "@/lib/api";
import { Field, PrimaryButton, inputCls } from "@/components/ui";

export interface ExtraCharge {
  id: number;
  resident_id: number;
  name: string;
  monthly_amount: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export const EXTRA_PRESETS = ["AC", "Cooler", "Geyser"];

export function extrasTotal(extras: ExtraCharge[] | undefined): number {
  return (extras ?? []).filter((e) => e.is_active).reduce((s, e) => s + e.monthly_amount, 0);
}

export function ExtrasBreakdown({ base, extras }: { base: number; extras: ExtraCharge[] | undefined }) {
  const list = extras ?? [];
  const active = list.filter((e) => e.is_active);
  return (
    <div className="rounded-xl bg-cream px-3 py-2">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Monthly total</dt>
      <dd className="text-base font-semibold text-pine-800">
        {formatRs(base)} base{active.length ? ` + ${active.map((e) => `${e.name} ${formatRs(e.monthly_amount)}`).join(" + ")}` : ""} ={" "}
        {formatRs(base + extrasTotal(list))}
      </dd>
      <p className="mt-1 text-xs text-slate-500">
        Extra charges apply from the next rent cycle, never to a cycle that already exists.
      </p>
      {list.filter((e) => !e.is_active).length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          Off: {list.filter((e) => !e.is_active).map((e) => e.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/** Admin manager: add (preset or custom name + amount), toggle, remove. */
export function ExtrasManager({
  residentId,
  extras,
  onChanged,
}: {
  residentId: number;
  extras: ExtraCharge[];
  onChanged: () => void;
}) {
  const [preset, setPreset] = useState("AC");
  const [customName, setCustomName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    const name = preset === "Custom" ? customName.trim() : preset;
    if (!name || !amount) return;
    try {
      await api(`/api/v1/admin/residents/${residentId}/extras`, {
        method: "POST",
        auth: true,
        body: { name, monthly_amount: Number(amount) },
      });
      setCustomName("");
      setAmount("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function toggle(charge: ExtraCharge) {
    try {
      await api(`/api/v1/admin/residents/${residentId}/extras/${charge.id}/toggle`, {
        method: "POST",
        auth: true,
        body: { is_active: !charge.is_active },
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function remove(charge: ExtraCharge) {
    try {
      await api(`/api/v1/admin/residents/${residentId}/extras/${charge.id}`, {
        method: "DELETE",
        auth: true,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-pine-100 p-3">
      <h4 className="font-extrabold text-pine-800">Extra charges (AC / Cooler / Geyser)</h4>
      <p className="mt-1 text-xs text-slate-500">
        Monthly total = base rent + active extras. Changes apply from the next rent cycle only.
      </p>
      {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
      <ul className="mt-2 grid gap-2">
        {extras.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2">
            <span className="font-bold text-pine-800">{c.name}</span>
            <span className="text-sm text-slate-600">{formatRs(c.monthly_amount)}/mo</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.is_active ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
              {c.is_active ? "On" : "Off"}
            </span>
            <span className="ml-auto flex gap-2">
              <button type="button" onClick={() => toggle(c)} className="text-sm font-bold text-pine-700 hover:underline">
                {c.is_active ? "Turn off" : "Turn on"}
              </button>
              <button type="button" onClick={() => remove(c)} className="text-sm font-bold text-red-700 hover:underline">
                Remove
              </button>
            </span>
          </li>
        ))}
        {extras.length === 0 ? <li className="text-sm text-slate-500">No extra charges.</li> : null}
      </ul>
      <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label="Extra">
          <select className={inputCls} value={preset} onChange={(e) => setPreset(e.target.value)}>
            {EXTRA_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="Custom">Custom…</option>
          </select>
        </Field>
        {preset === "Custom" ? (
          <Field label="Custom name">
            <input className={inputCls} value={customName} onChange={(e) => setCustomName(e.target.value)} required placeholder="e.g. Heater" />
          </Field>
        ) : (
          <Field label="Amount (Rs/month)">
            <input className={inputCls} type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 3000" />
          </Field>
        )}
        {preset === "Custom" ? (
          <Field label="Amount (Rs/month)">
            <input className={inputCls} type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 3000" />
          </Field>
        ) : null}
        <div className="flex items-end">
          <PrimaryButton type="submit">Add extra</PrimaryButton>
        </div>
      </form>
    </div>
  );
}
