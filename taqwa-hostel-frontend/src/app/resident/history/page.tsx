/* Resident rent history: my own cycles and my own payments only. */

"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import {
  DataTable,
  EmptyState,
  ErrorBox,
  Loading,
  SectionTitle,
  StatusPill,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "@/components/ui";

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
      <SectionTitle eyebrow={t.resident} title={t.rentHistory} sub="Your rent cycles and every payment you sent." />
      {error ? <ErrorBox message={error} /> : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <div className="grid gap-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">Rent cycles</h2>
            {cycles.length === 0 ? (
              <EmptyState icon={History} title="No rent cycles yet." />
            ) : (
              <DataTable>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Period</TableHeadCell>
                    <TableHeadCell>Paid / total</TableHeadCell>
                    <TableHeadCell>Remaining</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cycles.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-semibold">
                        {formatDate(c.start_date)} → {formatDate(c.due_date)}
                      </TableCell>
                      <TableCell>
                        {formatRs(c.paid_amount)} of {formatRs(c.total_amount)}
                      </TableCell>
                      <TableCell>{formatRs(c.remaining)}</TableCell>
                      <TableCell>
                        <StatusPill status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">Payments</h2>
            {payments.length === 0 ? (
              <EmptyState icon={History} title="No payments yet." />
            ) : (
              <DataTable>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Amount</TableHeadCell>
                    <TableHeadCell>Method</TableHeadCell>
                    <TableHeadCell>Date</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{formatRs(p.amount)}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{formatDate(p.payment_date)}</TableCell>
                      <TableCell>
                        <StatusPill status={p.status} />
                        {p.reject_reason ? (
                          <span className="mt-1 block text-xs font-medium text-danger">{p.reject_reason}</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            )}
          </section>
        </div>
      )}
    </ResidentShell>
  );
}
