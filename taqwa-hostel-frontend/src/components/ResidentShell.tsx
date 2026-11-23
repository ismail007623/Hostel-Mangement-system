/* Resident area shell: only a logged-in resident may enter.
   Role is verified with the backend (/me), not trusted from storage.
   The resident portal has its OWN simple nav with ONLY resident
   items (Home, Pay, History, Profile, Logout) — no public nav.
   A resident only ever sees their own data — every resident endpoint
   takes the resident id from the JWT. */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, loadSession, logout } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Loading } from "@/components/ui";

export function ResidentShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, largeText, setLargeText } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [name, setName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    api<{ role: string; full_name: string }>("/api/v1/auth/me", { auth: true })
      .then((me) => {
        if (me.role !== "resident") {
          router.replace(me.role === "admin" ? "/admin/dashboard" : "/login");
          return;
        }
        setName(me.full_name);
        setOk(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ok) return <Loading label={t.loading} />;

  const tabs = [
    ["/resident/home", t.home],
    ["/resident/pay", t.payRent],
    ["/resident/history", t.rentHistory],
    ["/resident/profile", t.editProfile],
  ] as const;

  const nav = (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMenuOpen(false)}
          className={`rounded-full px-3 py-1.5 text-sm font-bold ${
            pathname === href ? "bg-pine-700 text-white" : "text-pine-800 hover:bg-pine-100"
          }`}
        >
          {label}
        </Link>
      ))}
      <button
        type="button"
        onClick={logout}
        className="rounded-full px-3 py-1.5 text-sm font-bold text-slate-500 hover:text-red-700"
      >
        {t.logout}
      </button>
      <span className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={() => setLargeText(!largeText)}
          aria-pressed={largeText}
          title={t.largeText}
          className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
            largeText ? "border-gold-500 bg-gold-500/10 text-gold-600" : "border-slate-300 text-slate-600"
          }`}
        >
          A+
        </button>
        <button
          type="button"
          onClick={() => setLang(lang === "en" ? "ur" : "en")}
          className="rounded-full bg-pine-700 px-3 py-1.5 text-sm font-bold text-white"
        >
          {lang === "en" ? "اردو" : "English"}
        </button>
      </span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-40 border-b border-pine-100 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-700 text-lg font-extrabold text-cream">
            T
          </span>
          <span className="font-extrabold text-pine-800">
            {t.resident} · {name}
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            className="ml-auto rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-pine-800 sm:hidden"
          >
            {menuOpen ? "✕ Menu" : "☰ Menu"}
          </button>
          <div className="hidden w-full sm:block">{nav}</div>
          {menuOpen ? <div className="w-full sm:hidden">{nav}</div> : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
