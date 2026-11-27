/* Admin profile-edit requests: a resident asked to change name,
   phone, or CNIC (guardian number changes directly and never lands
   here). Approving applies the change; rejecting changes nothing. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { FileEdit } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Input,
  Loading,
  SectionTitle,
  StatusPill,
  useToast,
} from "@/components/ui";

interface EditRequest {
  id: number;
  resident_id: number;
  full_name?: string | null;
  phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  cnic_number?: string | null;
  status: string;
  reason?: string | null;
  created_at?: string;
}

export default function AdminEditsPage() {
  const { t } = useLang();
  const { success } = useToast();
  const [rows, setRows] = useState<EditRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmReject, setConfirmReject] = useState<EditRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<EditRequest[]>("/api/v1/admin/profile-edit-requests?status=pending", { auth: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: number, action: "approve" | "reject") {
    setBusy(true);
    try {
      await api(`/api/v1/admin/profile-edit-requests/${id}/${action}`, {
        method: "POST",
        auth: true,
        body: action === "reject" ? { reason: reason.trim() || "Rejected" } : {},
      });
      setReason("");
      setConfirmReject(null);
      success(t.saved);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  const changes = (r: EditRequest) =>
    [
      r.full_name ? `Name → ${r.full_name}` : "",
      r.phone ? `Phone → ${r.phone}` : "",
      r.guardian_name ? `Guardian name → ${r.guardian_name}` : "",
      r.guardian_phone ? `Guardian phone → ${r.guardian_phone}` : "",
      r.cnic_number ? `CNIC → ${r.cnic_number}` : "",
    ].filter(Boolean);

  return (
    <AdminShell>
      <SectionTitle
        eyebrow={t.admin}
        title={t.editRequests}
        sub="Name, phone or CNIC changes need your approval — the phone is the resident's login."
      />
      {error ? <ErrorBox message={error} /> : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileEdit} title="No pending edit requests." />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-ink">Request #{r.id}</span>
                <StatusPill status={r.status} />
              </div>
              <ul className="mt-2 list-disc ps-5 text-sm text-ink">
                {changes(r).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={() => act(r.id, "approve")} loading={busy}>
                  {t.approve}
                </Button>
                <span className="w-full max-w-xs">
                  <Input
                    aria-label={t.reason}
                    placeholder={t.reason}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </span>
                <Button variant="destructive" onClick={() => setConfirmReject(r)}>
                  {t.reject}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmReject !== null}
        title="Reject this edit request?"
        message={
          confirmReject
            ? `Reject request #${confirmReject.id}? Nothing changes for the resident.${reason.trim() ? ` Reason: ${reason.trim()}` : ""}`
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
