/* Admin area shell: only a logged-in admin may enter.
   Role is verified with the backend (/me), not trusted from storage.
   The admin area has its OWN left sidebar (desktop) / top bar
   (mobile) with ONLY admin items — no public website nav here.
   Urdu toggle + A+ large-text toggle live in the sidebar header. */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, loadSession, logout } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Loading } from "@/components/ui";

export function AdminShell({ children }: { children: ReactNode }) {
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
        if (me.role !== "admin") {
          router.replace(me.role === "resident" ? "/resident/home" : "/login");
          return;
        }
        setName(me.full_name);
        setOk(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ok) return <Loading label={t.loading} />;

  const items = [
    ["/admin/dashboard", t.dashboard],
    ["/admin/rooms", t.rooms],
    ["/admin/residents", t.residents],
    ["/admin/applications", t.applications],
    ["/admin/rent", t.rent],
    ["/admin/payments", t.payments],
    ["/admin/edits", t.editRequests],
    ["/admin/settings", t.settings],
  ] as const;

  const linkCls = (href: string) =>
    `block rounded-xl px-3 py-2.5 text-sm font-bold ${
      pathname === href ? "bg-pine-700 text-white" : "text-pine-800 hover:bg-pine-100"
    }`;

  const nav = (
    <>
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-700 text-xl font-extrabold text-cream">
          T
        </span>
        <span className="leading-tight">
          <span className="block text-base font-extrabold text-pine-800">Taqwa Boys Hostel</span>
          <span className="block text-xs font-medium text-slate-500">
            {t.admin} · {name}
          </span>
        </span>
      </div>
      <div className="mt-2 flex gap-2 px-1">
        <button
          type="button"
          onClick={() => setLargeText(!largeText)}
          aria-pressed={largeText}
          title={t.largeText}
          className={`flex-1 rounded-full border px-3 py-2 text-sm font-bold ${
            largeText ? "border-gold-500 bg-gold-500/10 text-gold-600" : "border-slate-300 text-slate-600"
          }`}
        >
          A+
        </button>
        <button
          type="button"
          onClick={() => setLang(lang === "en" ? "ur" : "en")}
          className="flex-1 rounded-full bg-pine-700 px-3 py-2 text-sm font-bold text-white"
        >
          {lang === "en" ? "اردو" : "English"}
        </button>
      </div>
      <nav className="mt-4 grid gap-1" aria-label="Admin">
        {items.map(([href, label]) => (
          <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={linkCls(href)}>
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={logout}
          className="mt-2 block rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-700 hover:bg-red-50"
        >
          {t.logout}
        </button>
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-pine-100 bg-white p-4 md:block">
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with collapsible admin menu */}
        <header className="sticky top-0 z-40 border-b border-pine-100 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-700 text-lg font-extrabold text-cream">
              T
            </span>
            <span className="font-extrabold text-pine-800">Taqwa · {t.admin}</span>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              className="ml-auto rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-pine-800"
            >
              {menuOpen ? "✕ Menu" : "☰ Menu"}
            </button>
          </div>
          {menuOpen ? <div className="mt-3">{nav}</div> : null}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </div>
    </div>
  );
}
