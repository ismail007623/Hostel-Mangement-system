/* Admin settings: grace days and the standard security amount.
   Rent duration is fixed at 30 days — the backend accepts a change,
   but the POC rule is 30 days for everyone, so the page shows it as
   fixed and never lets it be edited here. */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, inputCls } from "@/components/ui";

interface Settings {
  hostel_id: number;
  rent_duration_days: number;
  grace_days: number;
  security_standard: number;
}

export default function AdminSettingsPage() {
  const { t } = useLang();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [grace, setGrace] = useState(3);
  const [security, setSecurity] = useState(10000);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    setNotice("");
    try {
      const s = await api<Settings>("/api/v1/admin/settings", {
        method: "PUT",
        auth: true,
        body: { rent_duration_days: 30, grace_days: grace, security_standard: security },
      });
      setSettings(s);
      setNotice(t.saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.settings} />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      {!settings ? (
        <Loading label={t.loading} />
      ) : (
        <Card className="max-w-lg">
          <form onSubmit={submit} className="grid gap-4">
            <Field label="Rent duration (days)">
              <input className={inputCls} type="number" value={30} disabled />
              <span className="mt-1 block text-xs text-slate-500">
                Fixed at 30 days for every resident — due date is start date + 30 days.
              </span>
            </Field>
            <Field label="Grace days (after due date)">
              <input
                className={inputCls}
                type="number"
                min={0}
                max={30}
                value={grace}
                onChange={(e) => setGrace(Number(e.target.value))}
              />
            </Field>
            <Field label="Standard security (Rs)">
              <input
                className={inputCls}
                type="number"
                min={0}
                value={security}
                onChange={(e) => setSecurity(Number(e.target.value))}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Only the standard amount. The system tracks what each person actually paid — it never enforces it.
              </span>
            </Field>
            <PrimaryButton type="submit">{t.save}</PrimaryButton>
          </form>
        </Card>
      )}
    </AdminShell>
  );
}
