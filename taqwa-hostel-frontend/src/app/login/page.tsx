/* Single login page for everyone — no role choice.
   The backend decides the role from the database and the page
   redirects: admin -> /admin/dashboard, resident -> /resident/home.
   A resident whose application is not approved yet has no login at
   all, so the backend answers "Invalid phone or password" — the page
   shows that plus the approval hint, and never invents a status. */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, loadSession, login } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Footer, Header } from "@/components/SiteChrome";
import { Card, ErrorBox, Field, PrimaryButton, inputCls } from "@/components/ui";

export default function LoginPage() {
  const { t } = useLang();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already logged in (header always shows Login now): bounce straight
  // to the right portal instead of showing the form again. Runs only
  // on the client after mount, so it cannot cause a hydration mismatch.
  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      router.replace(existing.role === "admin" ? "/admin/dashboard" : "/resident/home");
    }
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const session = await login(phone.trim(), password);
      router.push(session.role === "admin" ? "/admin/dashboard" : "/resident/home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(`${t.wrongLogin} ${t.approvalPending}`);
      } else {
        setError(err instanceof ApiError ? err.message : t.tryAgain);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
        <Card className="w-full">
          <h1 className="text-2xl font-semibold text-ink">{t.loginTitle}</h1>
          <p className="mt-1 text-sm text-muted">{t.loginSub}</p>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <Field label={t.phone}>
              <input
                className={inputCls}
                required
                pattern="^03\d{9}$"
                placeholder="0300XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </Field>
            <Field label={t.password}>
              <input
                className={inputCls}
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            {error ? <ErrorBox message={error} /> : null}
            <PrimaryButton disabled={busy}>{busy ? t.loading : t.loginButton}</PrimaryButton>
          </form>
          <p className="mt-4 text-xs text-muted">
            Admin: Qari Sahib. Residents: login starts only after Qari approves your application and gives you a seat.
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
