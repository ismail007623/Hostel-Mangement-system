/* Admin payments: pending rent screenshots first. Qari opens the
   screenshot, checks the account, then approves or rejects it.
   Approving updates the rent cycle; rejecting leaves it unchanged. */

"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, StatusPill, inputCls } from "@/components/ui";

interface Payment {
  id: number;
  full_name: string;
  phone: string;
  rent_cycle_id: number;
  amount: number;
  method: string;
  screenshot_url: string;
  payment_date: string | null;
  status: string;
  reject_reason: string | null;
  building_name?: string | null;
  room_number?: string | null;
  cycle?: { due_date: string; total_amount: number; paid_amount: number; remaining: number; status: string };
}

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

export default function AdminPaymentsPage() {
  const { t } = useLang();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [rows, setRows] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      setRows(await api<Payment[]>(`/api/v1/admin/payments${query}`, { auth: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: number, action: "approve" | "reject") {
    try {
      await api(`/api/v1/admin/payments/${id}/${action}`, {
        method: "POST",
        auth: true,
        body: action === "reject" ? { reason: reason.trim() || "Rejected" } : {},
      });
      setOpenId(null);
      setReason("");
      setNotice(t.saved);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.payments} />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
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
            {f === "all" ? "All" : t[f as keyof typeof t] ?? f}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading label={t.loading} />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-slate-500">No payments in this filter.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-extrabold text-pine-800">{p.full_name}</span>
                <span className="text-sm text-slate-500">{p.phone}</span>
                <span className="font-bold text-pine-700">{formatRs(p.amount)}</span>
                <span className="text-sm text-slate-500">{p.method}</span>
                <span className="text-sm text-slate-500">{formatDate(p.payment_date)}</span>
                <span className="ml-auto">
                  <StatusPill status={p.status} />
                </span>
              </div>
              {p.cycle ? (
                <p className="mt-1 text-sm text-slate-600">
                  Cycle due {formatDate(p.cycle.due_date)} · Remaining {formatRs(p.cycle.remaining)}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === p.id ? null : p.id)}
                  className="rounded-full border-2 border-pine-700 px-4 py-2 text-sm font-bold text-pine-700"
                >
                  {t.viewScreenshot}
                </button>
                {p.status === "pending" ? (
                  <>
                    <PrimaryButton type="button" onClick={() => act(p.id, "approve")}>
                      {t.approve}
                    </PrimaryButton>
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}
                      className="rounded-full border-2 border-red-600 px-4 py-2 text-sm font-bold text-red-700"
                    >
                      {t.reject}
                    </button>
                  </>
                ) : null}
              </div>
              {openId === p.id ? (
                <div className="mt-4">
                  {p.screenshot_url ? (
                    <Image
                      src={p.screenshot_url.startsWith("/") ? p.screenshot_url : `/${p.screenshot_url}`}
                      alt={`Rent screenshot from ${p.full_name}`}
                      width={600}
                      height={800}
                      className="w-full max-w-md rounded-xl border"
                    />
                  ) : (
                    <p className="text-sm text-slate-500">No screenshot attached.</p>
                  )}
                  {p.status === "pending" ? (
                    <div className="mt-3 max-w-md">
                      <Field label={t.reason}>
                        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this rejected?" />
                      </Field>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => act(p.id, "reject")}
                          className="rounded-full bg-red-700 px-5 py-2.5 font-bold text-white"
                        >
                          {t.reject}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
