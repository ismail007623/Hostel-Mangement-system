/* Resident edit profile.
   Guardian phone changes directly. Name / phone / CNIC changes go
   as a request to Qari — nothing changes until he approves it,
   because the phone is the login and must stay unique. */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, StatusPill, inputCls } from "@/components/ui";

interface EditReq {
  id: number;
  full_name?: string | null;
  phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  cnic_number?: string | null;
  status: string;
}

export default function ResidentProfilePage() {
  const { t } = useLang();
  const [guardianPhone, setGuardianPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [requests, setRequests] = useState<EditReq[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<EditReq[]>("/api/v1/resident/profile/edit-requests", { auth: true })
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  async function saveGuardian(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api("/api/v1/resident/profile", {
        method: "PUT",
        auth: true,
        body: { guardian_phone: guardianPhone.trim() },
      });
      setNotice("Guardian phone updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function requestChange(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const body: Record<string, string> = {};
    if (fullName.trim()) body.full_name = fullName.trim();
    if (phone.trim()) body.phone = phone.trim();
    if (cnic.trim()) body.cnic_number = cnic.trim();
    if (Object.keys(body).length === 0) {
      setError("Fill at least one field to change.");
      return;
    }
    try {
      await api("/api/v1/resident/profile/edit-request", { method: "POST", auth: true, body });
      setFullName("");
      setPhone("");
      setCnic("");
      setNotice("Request sent to Qari Sahib for approval.");
      const rows = await api<EditReq[]>("/api/v1/resident/profile/edit-requests", { auth: true }).catch(() => []);
      setRequests(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  const changes = (r: EditReq) =>
    [
      r.full_name ? `Name → ${r.full_name}` : "",
      r.phone ? `Phone → ${r.phone}` : "",
      r.guardian_name ? `Guardian name → ${r.guardian_name}` : "",
      r.guardian_phone ? `Guardian phone → ${r.guardian_phone}` : "",
      r.cnic_number ? `CNIC → ${r.cnic_number}` : "",
    ].filter(Boolean);

  return (
    <ResidentShell>
      <SectionTitle eyebrow={t.resident} title={t.editProfile} />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      <div className="grid gap-4">
        <Card>
          <h3 className="font-extrabold text-pine-800">Guardian phone — changes at once</h3>
          <form onSubmit={saveGuardian} className="mt-3 flex flex-wrap gap-2">
            <input
              className={`${inputCls} max-w-xs`}
              required
              pattern="^03\d{9}$"
              placeholder="0300XXXXXXX"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
            />
            <PrimaryButton type="submit">{t.save}</PrimaryButton>
          </form>
        </Card>
        <Card>
          <h3 className="font-extrabold text-pine-800">Name, phone, or CNIC — needs Qari&apos;s approval</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your phone is your login, so Qari must approve the change first. Nothing changes until he approves it.
          </p>
          <form onSubmit={requestChange} className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label={t.fullName}>
              <input className={inputCls} minLength={3} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label={t.phone}>
              <input className={inputCls} pattern="^03\d{9}$" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label={t.cnic}>
              <input className={inputCls} pattern="^\d{5}-\d{7}-\d$" value={cnic} onChange={(e) => setCnic(e.target.value)} />
            </Field>
            <div className="sm:col-span-3">
              <PrimaryButton type="submit">Send request to Qari</PrimaryButton>
            </div>
          </form>
        </Card>
        <Card>
          <h3 className="font-extrabold text-pine-800">My requests</h3>
          {loading ? (
            <Loading label={t.loading} />
          ) : requests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No edit requests yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2.5">
                  <span className="text-sm font-semibold text-pine-800">{changes(r).join(" · ") || `Request #${r.id}`}</span>
                  <span className="ml-auto">
                    <StatusPill status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </ResidentShell>
  );
}
