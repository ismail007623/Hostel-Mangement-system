/* Resident pay rent: upload a payment screenshot for the current
   cycle. The cycle only changes when Qari approves the payment —
   submitting never marks rent as paid by itself. */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Loading,
  SectionTitle,
  Select,
  inputCls,
  useToast,
} from "@/components/ui";

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
  const { success } = useToast();
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
      success("Payment sent for approval.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResidentShell>
      <SectionTitle eyebrow={t.resident} title={t.payRent} sub="Send a payment screenshot — Qari approves it before your rent is marked paid." />
      {loading ? (
        <Loading label={t.loading} />
      ) : !cycle ? (
        <Card>
          <p className="text-muted">No open rent cycle. Please ask Qari Sahib.</p>
        </Card>
      ) : done ? (
        <Card className="border-line bg-active">
          <p className="flex items-start gap-2 font-semibold text-brand">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            Payment sent for approval. Qari Sahib will check the screenshot and approve it.
          </p>
        </Card>
      ) : (
        <Card className="max-w-lg">
          <p className="mb-4 text-sm text-muted">
            Current cycle: remaining <strong className="text-ink">{formatRs(cycle.remaining)}</strong> of{" "}
            {formatRs(cycle.total_amount)}.
          </p>
          <form onSubmit={submit} className="grid gap-4">
            <Input
              label="Amount (Rs)"
              required
              type="number"
              min={1}
              max={cycle.remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              helperText={`Up to ${formatRs(cycle.remaining)} for this cycle.`}
            />
            <Select
              label="Payment method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={METHODS.map((m) => ({ value: m, label: m }))}
            />
            <Field label="Rent screenshot (PNG or JPG, max 5MB)">
              <input
                className={inputCls}
                required
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            {file ? <p className="text-xs text-muted">Selected: {file.name}</p> : null}
            {error ? <ErrorBox message={error} /> : null}
            <Button type="submit" loading={busy} disabled={!file}>
              {busy ? t.loading : "Send for approval"}
            </Button>
          </form>
        </Card>
      )}
    </ResidentShell>
  );
}
