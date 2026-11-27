/* Admin settings: grace days and the standard security amount.
   Rent duration is fixed at 30 days — the backend accepts a change,
   but the POC rule is 30 days for everyone, so the page shows it as
   fixed and never lets it be edited here. */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import {
  Button,
  Card,
  ErrorBox,
  Input,
  Loading,
  SectionTitle,
  useToast,
} from "@/components/ui";

interface Settings {
  hostel_id: number;
  rent_duration_days: number;
  grace_days: number;
  security_standard: number;
}

export default function AdminSettingsPage() {
  const { t, lang, setLang } = useLang();
  const { success } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [grace, setGrace] = useState(3);
  const [security, setSecurity] = useState(10000);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Settings>("/api/v1/admin/settings", { auth: true })
      .then((s) => {
        setSettings(s);
        setGrace(s.grace_days);
        setSecurity(s.security_standard);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t.tryAgain));
  }, [t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const s = await api<Settings>("/api/v1/admin/settings", {
        method: "PUT",
        auth: true,
        body: { rent_duration_days: 30, grace_days: grace, security_standard: security },
      });
      setSettings(s);
      success(t.saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.settings} sub="Rent cycle rules and the standard security amount." />
      {error ? <ErrorBox message={error} /> : null}
      <div className="mb-4 grid max-w-2xl gap-4">
        <Card>
          <h2 className="text-lg font-semibold text-ink">Preferences</h2>
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-ink">Language</p>
            <div className="inline-flex gap-1 rounded-btn bg-page p-1" role="group" aria-label="Language">
              {(
                [
                  { key: "en", label: "English" },
                  { key: "ur", label: "اردو" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={lang === opt.key}
                  onClick={() => setLang(opt.key)}
                  className={`h-10 rounded-md px-4 text-sm font-semibold ${
                    lang === opt.key ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Applies everywhere — admin, resident and the public pages.</p>
          </div>
        </Card>
      </div>
      {!settings ? (
        <Loading label={t.loading} />
      ) : (
        <form onSubmit={submit} className="grid max-w-2xl gap-4">
          <Card>
            <h2 className="text-lg font-semibold text-ink">Rent cycle</h2>
            <div className="mt-4 grid gap-4">
              <Input
                label="Rent duration (days)"
                type="number"
                value={30}
                disabled
                helperText="Fixed at 30 days for every resident — due date is start date + 30 days."
              />
              <Input
                label="Grace days (after due date)"
                type="number"
                min={0}
                max={30}
                value={grace}
                onChange={(e) => setGrace(Number(e.target.value))}
                helperText="Extra days after the due date before rent counts as overdue."
              />
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-ink">Security</h2>
            <div className="mt-4 grid gap-4">
              <Input
                label="Standard security (Rs)"
                type="number"
                min={0}
                value={security}
                onChange={(e) => setSecurity(Number(e.target.value))}
                helperText="Only the standard amount. The system tracks what each person actually paid — it never enforces it."
              />
            </div>
          </Card>
          <div>
            <Button type="submit" loading={busy}>
              {t.save}
            </Button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
