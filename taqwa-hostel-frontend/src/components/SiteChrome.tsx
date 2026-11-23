"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { loadSession, logout, waLink } from "@/lib/api";

export const QARI_PHONE = "03004493800";
export const HOSTEL_PHONE = "03228030864";
export const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=5+UMT+Road+Block+C2+Phase+1+Johar+Town+Lahore";

export function Header() {
  const { lang, setLang, t, largeText, setLargeText } = useLang();
  const pathname = usePathname();
  const session = typeof window !== "undefined" ? loadSession() : null;
  const linkCls = (href: string) =>
    `rounded-full px-3 py-2 text-sm font-semibold ${
      pathname === href ? "bg-pine-700 text-white" : "text-pine-800 hover:bg-pine-100"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-pine-100 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-700 text-xl font-extrabold text-cream">
            T
          </span>
          <span className="leading-tight">
            <span className="block text-base font-extrabold text-pine-800">Taqwa Boys Hostel</span>
            <span className="block text-xs font-medium text-slate-500">Johar Town, Lahore — near UMT</span>
          </span>
        </Link>
        <nav className="ml-auto flex flex-wrap items-center gap-1">
          <Link href="/" className={linkCls("/")}>
            {t.home}
          </Link>
          <Link href="/#seats" className={linkCls("/#seats")}>
            {t.seats}
          </Link>
          <Link href="/#facilities" className={linkCls("/#facilities")}>
            {t.facilities}
          </Link>
          <Link href="/#about" className={linkCls("/#about")}>
            {t.about}
          </Link>
          {session?.role === "admin" ? (
            <Link href="/admin/dashboard" className={linkCls("/admin/dashboard")}>
              {t.admin}
            </Link>
          ) : session?.role === "resident" ? (
            <Link href="/resident/home" className={linkCls("/resident/home")}>
              {t.resident}
            </Link>
          ) : (
            <Link href="/login" className={linkCls("/login")}>
              {t.login}
            </Link>
          )}
          {session && (
            <button
              type="button"
              onClick={logout}
              className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-pine-100"
            >
              {t.logout}
            </button>
          )}
          <button
            type="button"
            onClick={() => setLargeText(!largeText)}
            aria-pressed={largeText}
            title={t.largeText}
            className={`rounded-full border px-3 py-2 text-sm font-bold ${
              largeText ? "border-gold-500 bg-gold-500/10 text-gold-600" : "border-slate-300 text-slate-600"
            }`}
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            className="rounded-full bg-pine-700 px-3 py-2 text-sm font-bold text-white"
          >
            {lang === "en" ? "اردو" : "English"}
          </button>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t border-pine-100 bg-pine-800 text-cream">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold">Taqwa Boys Hostel</p>
          <p className="mt-1 text-sm text-cream/80">{t.address}</p>
          <p className="mt-1 text-sm text-cream/80">{t.open24}</p>
        </div>
        <div>
          <p className="font-bold">Qari Abdul Majeed</p>
          <p className="mt-1 text-sm">
            <a className="underline" href={`tel:+92${QARI_PHONE.slice(1)}`}>
              {QARI_PHONE}
            </a>{" "}
            ·{" "}
            <a className="underline" href={waLink(QARI_PHONE)}>
              WhatsApp
            </a>
          </p>
          <p className="mt-1 text-sm">
            Hostel:{" "}
            <a className="underline" href={`tel:+92${HOSTEL_PHONE.slice(1)}`}>
              {HOSTEL_PHONE}
            </a>
          </p>
        </div>
        <div>
          <a className="text-sm underline" href={MAPS_URL} target="_blank" rel="noreferrer">
            {t.openMap}
          </a>
          <p className="mt-2 text-xs text-cream/60">
            Rent cycle: 30 days from your start date. No OTP login — phone + password only.
          </p>
        </div>
      </div>
    </footer>
  );
}
