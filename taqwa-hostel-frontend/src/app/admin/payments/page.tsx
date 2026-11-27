/* Admin payments: pending rent screenshots first. Qari opens the
   screenshot, checks the account, then approves or rejects it.
   Approving updates the rent cycle; rejecting leaves it unchanged. */

"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Eye } from "lucide-react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Loading,
  Modal,
  SectionTitle,
  StatusPill,
  Toolbar,
  useToast,
} from "@/components/ui";

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
  const { success } = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [rows, setRows] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const [confirmReject, setConfirmReject] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await api(`/api/v1/admin/payments/${id}/${action}`, {
        method: "POST",
        auth: true,
        body: action === "reject" ? { reason: reason.trim() || "Rejected" } : {},
      });
      setViewing(null);
      setConfirmReject(null);
      setReason("");
      success(t.saved);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <SectionTitle
        eyebrow={t.admin}
        title={t.payments}
        sub="Check each rent screenshot, then approve or reject it. Approving updates the rent cycle."
      />
      {error ? <ErrorBox message={error} /> : null}
      <Toolbar className="mb-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Payment status filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`inline-flex h-11 items-center rounded-btn px-4 text-sm font-semibold ${
                filter === f
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink hover:bg-page"
              }`}
            >
              {f === "all" ? "All" : t[f as keyof typeof t] ?? f}
            </button>
          ))}
        </div>
      </Toolbar>
      {loading ? (
        <Loading label={t.loading} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Eye} title="No payments in this filter." />
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-ink">{p.full_name}</span>
                <span className="text-sm text-muted">{p.phone}</span>
                <span className="font-semibold text-brand">{formatRs(p.amount)}</span>
                <span className="text-sm text-muted">{p.method}</span>
                <span className="text-sm text-muted">{formatDate(p.payment_date)}</span>
                <span className="ms-auto">
                  <StatusPill status={p.status} />
                </span>
              </div>
              {p.cycle ? (
                <p className="mt-1 text-sm text-muted">
                  Cycle due {formatDate(p.cycle.due_date)} · Remaining {formatRs(p.cycle.remaining)}
                </p>
              ) : null}
              {p.reject_reason ? (
                <p className="mt-1 text-sm font-medium text-danger">Rejected: {p.reject_reason}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" icon={Eye} onClick={() => setViewing(p)}>
                  {t.viewScreenshot}
                </Button>
                {p.status === "pending" ? (
                  <>
                    <Button onClick={() => act(p.id, "approve")} loading={busy}>
                      {t.approve}
                    </Button>
                    <Button variant="destructive" onClick={() => setViewing(p)}>
                      {t.reject}
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewing ? (
        <Modal
          title={`Screenshot — ${viewing.full_name} · ${formatRs(viewing.amount)}`}
          onClose={() => {
            setViewing(null);
            setReason("");
          }}
          footer={
            viewing.status === "pending" ? (
              <>
                <Button variant="secondary" onClick={() => setViewing(null)}>
                  Close
                </Button>
                <Button variant="destructive" onClick={() => setConfirmReject(viewing)}>
                  {t.reject}
                </Button>
                <Button onClick={() => act(viewing.id, "approve")} loading={busy}>
                  {t.approve}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
            )
          }
        >
          {viewing.screenshot_url ? (
            <Image
              src={viewing.screenshot_url.startsWith("/") ? viewing.screenshot_url : `/${viewing.screenshot_url}`}
              alt={`Rent screenshot from ${viewing.full_name}`}
              width={600}
              height={800}
              className="w-full max-w-md rounded-card border border-line"
            />
          ) : (
            <p className="text-sm text-muted">No screenshot attached.</p>
          )}
          {viewing.status === "pending" ? (
            <div className="mt-4 max-w-md">
              <Field label={t.reason}>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this rejected?" />
              </Field>
            </div>
          ) : null}
        </Modal>
      ) : null}

      <ConfirmDialog
        open={confirmReject !== null}
        title="Reject this payment?"
        message={
          confirmReject
            ? `Reject ${formatRs(confirmReject.amount)} from ${confirmReject.full_name}? The rent cycle stays unchanged.${reason.trim() ? ` Reason: ${reason.trim()}` : ""}`
            : ""
        }
        confirmLabel={t.reject}
        onConfirm={() => confirmReject && act(confirmReject.id, "reject")}
        onCancel={() => setConfirmReject(null)}
        loading={busy}
      />
    </AdminShell>
  );
}
