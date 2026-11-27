"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { waLink } from "@/lib/api";

export const QARI_PHONE = "03004493800";
export const HOSTEL_PHONE = "03228030864";
export const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=5+UMT+Road+Block+C2+Phase+1+Johar+Town+Lahore";

export function Header() {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const linkCls = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-semibold ${
      pathname === href ? "bg-active text-brand" : "text-ink hover:bg-page"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-lg font-semibold text-white">
            T
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold text-ink">Taqwa Boys Hostel</span>
            <span className="block text-xs font-medium text-muted">Johar Town, Lahore — near UMT</span>
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
          {/* Public header always shows Login only. Admin/Resident links
              live in their own sidebar/nav after login — reading the
              session here rendered "Login" on the server but "Admin" on
              the client and broke hydration. */}
          <Link href="/login" className={linkCls("/login")}>
            {t.login}
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            className="rounded-btn bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
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
    <footer className="border-t border-line bg-brand text-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">Taqwa Boys Hostel</p>
          <p className="mt-1 text-sm text-white/80">{t.address}</p>
          <p className="mt-1 text-sm text-white/80">{t.open24}</p>
        </div>
        <div>
          <p className="font-semibold">Qari Abdul Majeed</p>
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
          <p className="mt-2 text-xs text-white/60">
            Rent cycle: 30 days from your start date. No OTP login — phone + password only.
          </p>
        </div>
      </div>
    </footer>
  );
}
