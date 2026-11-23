/* Admin rent: who paid and who is due. Paid is green, due soon is
   yellow, overdue is red. Reminders are plain wa.me links from the
   backend — no WhatsApp API. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, Loading, SectionTitle, StatusPill } from "@/components/ui";

interface DueRow {
  resident_id: number;
  full_name: string;
  phone: string;
  guardian_phone?: string;
  building_name?: string | null;
  portion_name?: string | null;
  room_number?: string | null;
  seat_label?: string | null;
  whatsapp_url?: string;
  cycle: {
    due_date: string;
    total_amount: number;
    paid_amount: number;
    remaining: number;
    status: string;
  };
}
interface PaidRow {
  resident_id: number;
  full_name: string;
  phone: string;
  cycle: {
    due_date: string;
    total_amount: number;
    paid_amount: number;
    status: string;
  };
}

const FILTERS = ["all", "due", "due_soon", "overdue"] as const;

export default function AdminRentPage() {
  const { t } = useLang();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [due, setDue] = useState<DueRow[]>([]);
  const [paid, setPaid] = useState<PaidRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        api<DueRow[]>(`/api/v1/admin/rent/due-list?status=${filter}`, { auth: true }),
        api<PaidRow[]>("/api/v1/admin/rent/paid-list", { auth: true }),
      ]);
      setDue(d);
      setPaid(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.rent} />
      {error ? <ErrorBox message={error} /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              filter === f ? "bg-pine-700 text-white" : "border border-slate-300 bg-white text-pine-800"
            }`}
          >
            {f === "all" ? "All due" : t[f as keyof typeof t] ?? f}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="font-extrabold text-pine-800">Due ({due.length})</h3>
            {due.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nobody is due in this filter.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {due.map((r) => (
                  <li key={r.resident_id} className="rounded-xl bg-cream p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-pine-800">{r.full_name}</span>
                      <span className="text-sm text-slate-500">{r.phone}</span>
                      <span className="ml-auto">
                        <StatusPill status={r.cycle.status} />
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {r.building_name ?? ""} {r.room_number ? `· Room ${r.room_number}` : ""} · Due{" "}
                      {formatDate(r.cycle.due_date)} · Remaining {formatRs(r.cycle.remaining)} of{" "}
                      {formatRs(r.cycle.total_amount)}
                    </p>
                    {r.whatsapp_url ? (
                      <a
                        href={r.whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white"
                      >
                        {t.remindWhatsApp}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="font-extrabold text-pine-800">Paid ({paid.length})</h3>
            {paid.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No fully-paid cycles yet.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {paid.slice(0, 30).map((r, i) => (
                  <li key={`${r.resident_id}-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-green-50 p-3">
                    <span className="font-bold text-pine-800">{r.full_name}</span>
                    <span className="text-sm text-slate-500">{r.phone}</span>
                    <span className="ml-auto text-sm font-bold text-green-800">{formatRs(r.cycle.paid_amount)}</span>
                    <StatusPill status="paid" label={t.paid} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
