/* Resident pay rent: upload a payment screenshot for the current
   cycle. The cycle only changes when Qari approves the payment —
   submitting never marks rent as paid by itself. */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, inputCls } from "@/components/ui";

interface Cycle {
  id: number;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  status: string;
}

const METHODS = ["JazzCash", "Easypaisa", "Bank", "Cash"];

export default function ResidentPayPage() {
  const { t } = useLang();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("JazzCash");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Cycle>("/api/v1/resident/rent/current", { auth: true })
      .then((c) => {
        setCycle(c);
        setAmount(String(c.remaining));
      })
      .catch(() => setCycle(null))
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!cycle || !file) return;
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("rent_cycle_id", String(cycle.id));
      form.append("amount", amount);
      form.append("method", method);
      form.append("screenshot", file);
      await api("/api/v1/resident/payments", { method: "POST", auth: true, formData: form });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResidentShell>
      <SectionTitle eyebrow={t.resident} title={t.payRent} />
      {loading ? (
        <Loading label={t.loading} />
      ) : !cycle ? (
        <Card>
          <p className="text-slate-500">No open rent cycle. Please ask Qari Sahib.</p>
        </Card>
      ) : done ? (
        <Card className="border-green-200 bg-green-50">
          <p className="font-bold text-green-800">
            Payment sent for approval. Qari Sahib will check the screenshot and approve it.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="mb-4 text-slate-600">
            Current cycle: remaining <strong className="text-pine-800">{formatRs(cycle.remaining)}</strong> of{" "}
            {formatRs(cycle.total_amount)}.
          </p>
          <form onSubmit={submit} className="grid gap-4">
            <Field label="Amount (Rs)">
              <input
                className={inputCls}
                required
                type="number"
                min={1}
                max={cycle.remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Payment method">
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rent screenshot (PNG or JPG, max 5MB)">
              <input
                className={inputCls}
                required
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            {error ? <ErrorBox message={error} /> : null}
            <PrimaryButton disabled={busy || !file}>{busy ? t.loading : "Send for approval"}</PrimaryButton>
          </form>
        </Card>
      )}
    </ResidentShell>
  );
}
