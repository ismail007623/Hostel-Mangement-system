/* Admin payments: pending rent screenshots first. Qari opens the
   screenshot, checks the account, then approves or rejects it.
   Approving updates the rent cycle; rejecting leaves it unchanged. */

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

type PaymentFilter = (typeof FILTERS)[number];

function validPaymentFilter(v: string | null): PaymentFilter | null {
  return v !== null && (FILTERS as readonly string[]).includes(v) ? (v as PaymentFilter) : null;
}

/* Month param is YYYY-MM. The backend has no month filter, so this is
   applied client-side over the loaded list (see visibleRows below). */
function validMonth(v: string | null): string | null {
  return v !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function AdminPaymentsPageContent() {
  const { t } = useLang();
  const { success } = useToast();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [filter, setFilter] = useState<PaymentFilter>(
    validPaymentFilter(searchParams.get("status")) ?? "pending"
  );
  const [month, setMonth] = useState<string | null>(validMonth(searchParams.get("month")));

  // Keep the URL in sync so a filtered view stays shareable / refreshable.
  function syncUrl(nextFilter: PaymentFilter, nextMonth: string | null) {
    const params = new URLSearchParams();
    if (nextFilter !== "pending") params.set("status", nextFilter);
    if (nextMonth) params.set("month", nextMonth);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }
  function changeFilter(f: PaymentFilter) {
    setFilter(f);
    syncUrl(f, month);
  }
  function clearMonth() {
    setMonth(null);
    syncUrl(filter, null);
  }
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

  // Client-side month filter (backend has no month param): keep only
  // payments whose payment_date falls in the requested YYYY-MM.
  const visibleRows = useMemo(
    () => (month ? rows.filter((p) => (p.payment_date ?? "").startsWith(month)) : rows),
    [rows, month]
  );

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
              onClick={() => changeFilter(f)}
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
      {month ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-active px-3 py-2 text-sm">
          <span className="font-semibold text-ink">Showing payments from {monthLabel(month)}</span>
          <span className="text-muted">(client-side filter — the backend has no month filter)</span>
          <button
            type="button"
            onClick={clearMonth}
            className="ms-auto inline-flex h-8 items-center rounded-btn border border-line bg-white px-3 text-xs font-semibold text-ink hover:bg-page"
          >
            Clear month
          </button>
        </div>
      ) : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : visibleRows.length === 0 ? (
        <EmptyState icon={Eye} title="No payments in this filter." />
      ) : (
        <div className="grid gap-3">
          {visibleRows.map((p) => (
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

/* useSearchParams needs a Suspense boundary (Next.js App Router). */
export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <AdminPaymentsPageContent />
    </Suspense>
  );
}
