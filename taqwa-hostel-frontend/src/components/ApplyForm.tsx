/* Public onboarding form (also used by the invite link /apply?token=).
   Creates a PENDING application — login starts only after the admin
   approves it and assigns a seat. */

"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Card, ErrorBox, Field, PrimaryButton, inputCls } from "./ui";

export default function ApplyForm() {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    father_name: "",
    phone: "",
    guardian_phone: "",
    cnic_number: "",
    password: "",
    start_date: new Date().toISOString().slice(0, 10),
    monthly_rent: 8000,
    security_paid: 0,
  });

  const set = (key: keyof typeof form, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/v1/public/apply", { method: "POST", body: form });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="border-green-200 bg-green-50">
        <p className="font-bold text-green-800">{t.submitted}</p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t.fullName}>
          <input className={inputCls} required minLength={3} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </Field>
        <Field label={t.fatherName}>
          <input className={inputCls} required minLength={3} value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
        </Field>
        <Field label={t.phone}>
          <input className={inputCls} required pattern="^03\d{9}$" placeholder="0300XXXXXXX" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={t.guardianPhone}>
          <input className={inputCls} required pattern="^03\d{9}$" placeholder="0300XXXXXXX" value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
        </Field>
        <Field label={t.cnic}>
          <input className={inputCls} required pattern="^\d{5}-\d{7}-\d$" placeholder="35202-1234567-1" value={form.cnic_number} onChange={(e) => set("cnic_number", e.target.value)} />
        </Field>
        <Field label={t.password} hint={t.passwordHint}>
          <input className={inputCls} required type="password" minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <Field label={t.startDate}>
          <input className={inputCls} required type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </Field>
        <Field label={t.monthlyRent}>
          <input className={inputCls} required type="number" min={1} value={form.monthly_rent} onChange={(e) => set("monthly_rent", Number(e.target.value))} />
        </Field>
        <Field label={t.securityPaid}>
          <input className={inputCls} type="number" min={0} value={form.security_paid} onChange={(e) => set("security_paid", Number(e.target.value))} />
        </Field>
        <div className="sm:col-span-2">
          {error ? <ErrorBox message={error} /> : null}
          <div className="mt-3">
            <PrimaryButton disabled={busy}>{busy ? t.loading : t.submit}</PrimaryButton>
          </div>
        </div>
      </form>
    </Card>
  );
}
