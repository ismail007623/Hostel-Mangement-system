/* Admin profile-edit requests: a resident asked to change name,
   phone, or CNIC (guardian number changes directly and never lands
   here). Approving applies the change; rejecting changes nothing. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, StatusPill, inputCls } from "@/components/ui";

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
  const [rows, setRows] = useState<EditRequest[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

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
    try {
      await api(`/api/v1/admin/profile-edit-requests/${id}/${action}`, {
        method: "POST",
        auth: true,
        body: action === "reject" ? { reason: reason.trim() || "Rejected" } : {},
      });
      setReason("");
      setNotice(t.saved);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
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
      <SectionTitle eyebrow={t.admin} title={t.editRequests} />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-slate-500">No pending edit requests.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-extrabold text-pine-800">Request #{r.id}</span>
                <StatusPill status={r.status} />
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {changes(r).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PrimaryButton type="button" onClick={() => act(r.id, "approve")}>
                  {t.approve}
                </PrimaryButton>
                <Field label={t.reason}>
                  <input className={`${inputCls} w-56`} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <button
                  type="button"
                  onClick={() => act(r.id, "reject")}
                  className="rounded-full border-2 border-red-600 px-5 py-3 font-bold text-red-700"
                >
                  {t.reject}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
