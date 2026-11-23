/* Resident rent history: my own cycles and my own payments only. */

"use client";

import { useEffect, useState } from "react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import { Card, ErrorBox, Loading, SectionTitle, StatusPill } from "@/components/ui";

interface Cycle {
  id: number;
  start_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  status: string;
}
interface Payment {
  id: number;
  amount: number;
  method: string;
  payment_date: string | null;
  status: string;
  reject_reason: string | null;
  cycle?: { due_date: string };
}

export default function ResidentHistoryPage() {
  const { t } = useLang();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ cycles: Cycle[]; payments: Payment[] }>("/api/v1/resident/rent-history", { auth: true })
      .then((d) => {
        setCycles(d.cycles ?? []);
        setPayments(d.payments ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t.tryAgain))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <ResidentShell>
      <SectionTitle eyebrow={t.resident} title={t.rentHistory} />
      {error ? <ErrorBox message={error} /> : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <div className="grid gap-6">
          <Card>
            <h3 className="font-extrabold text-pine-800">Rent cycles</h3>
            {cycles.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No rent cycles yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {cycles.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2.5">
                    <span className="text-sm font-bold text-pine-800">
                      {formatDate(c.start_date)} → {formatDate(c.due_date)}
                    </span>
                    <span className="text-sm text-slate-500">
                      Paid {formatRs(c.paid_amount)} of {formatRs(c.total_amount)} · Remaining {formatRs(c.remaining)}
                    </span>
                    <span className="ml-auto">
                      <StatusPill status={c.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="font-extrabold text-pine-800">Payments</h3>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No payments yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2.5">
                    <span className="font-bold text-pine-800">{formatRs(p.amount)}</span>
                    <span className="text-sm text-slate-500">{p.method}</span>
                    <span className="text-sm text-slate-500">{formatDate(p.payment_date)}</span>
                    {p.reject_reason ? <span className="text-sm text-red-700">{p.reject_reason}</span> : null}
                    <span className="ml-auto">
                      <StatusPill status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </ResidentShell>
  );
}
