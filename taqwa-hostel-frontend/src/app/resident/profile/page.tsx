/* Resident edit profile.
   Guardian phone changes directly. Name / phone / CNIC changes go
   as a request to Qari — nothing changes until he approves it,
   because the phone is the login and must stay unique. */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FileEdit } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Input,
  Loading,
  SectionTitle,
  StatusPill,
  useToast,
} from "@/components/ui";

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
  const { success } = useToast();
  const [guardianPhone, setGuardianPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [requests, setRequests] = useState<EditReq[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<EditReq[]>("/api/v1/resident/profile/edit-requests", { auth: true })
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  async function saveGuardian(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/v1/resident/profile", {
        method: "PUT",
        auth: true,
        body: { guardian_phone: guardianPhone.trim() },
      });
      success("Guardian phone updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  async function requestChange(e: FormEvent) {
    e.preventDefault();
    setError("");
    const body: Record<string, string> = {};
    if (fullName.trim()) body.full_name = fullName.trim();
    if (phone.trim()) body.phone = phone.trim();
    if (cnic.trim()) body.cnic_number = cnic.trim();
    if (Object.keys(body).length === 0) {
      setError("Fill at least one field to change.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/v1/resident/profile/edit-request", { method: "POST", auth: true, body });
      setFullName("");
      setPhone("");
      setCnic("");
      success("Request sent to Qari Sahib for approval.");
      const rows = await api<EditReq[]>("/api/v1/resident/profile/edit-requests", { auth: true }).catch(() => []);
      setRequests(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
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
      <SectionTitle eyebrow={t.resident} title={t.editProfile} sub="Guardian phone changes at once; name, phone or CNIC needs Qari's approval." />
      {error ? <ErrorBox message={error} /> : null}
      <div className="grid gap-4">
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold text-ink">Guardian phone — changes at once</h2>
          <form onSubmit={saveGuardian} className="mt-3 flex flex-wrap items-end gap-2">
            <span className="w-full max-w-xs">
              <Input
                label="Guardian phone"
                required
                pattern="^03\d{9}$"
                placeholder="0300XXXXXXX"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
              />
            </span>
            <Button type="submit" loading={busy}>
              {t.save}
            </Button>
          </form>
        </Card>
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold text-ink">Name, phone, or CNIC — needs Qari&apos;s approval</h2>
          <p className="mt-1 text-sm text-muted">
            Your phone is your login, so Qari must approve the change first. Nothing changes until he approves it.
          </p>
          <form onSubmit={requestChange} className="mt-3 grid gap-3 sm:grid-cols-3">
            <Input
              label={t.fullName}
              minLength={3}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label={t.phone}
              pattern="^03\d{9}$"
              placeholder="0300XXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label={t.cnic}
              pattern="^\d{5}-\d{7}-\d$"
              placeholder="35202-XXXXXXX-X"
              value={cnic}
              onChange={(e) => setCnic(e.target.value)}
            />
            <div className="sm:col-span-3">
              <Button type="submit" loading={busy}>
                Send request to Qari
              </Button>
            </div>
          </form>
        </Card>
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold text-ink">My requests</h2>
          {loading ? (
            <Loading label={t.loading} />
          ) : requests.length === 0 ? (
            <EmptyState icon={FileEdit} title="No edit requests yet." />
          ) : (
            <ul className="mt-3 grid gap-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-card bg-page px-3 py-2.5"
                >
                  <span className="text-sm font-semibold text-ink">{changes(r).join(" · ") || `Request #${r.id}`}</span>
                  <span className="ms-auto">
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
