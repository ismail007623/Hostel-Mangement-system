/* Admin area shell: only a logged-in admin may enter.
   Role is verified with the backend (/me), not trusted from storage. */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, loadSession, logout } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Header } from "@/components/SiteChrome";
import { Loading } from "@/components/ui";

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [name, setName] = useState("");

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

  const tabs = [
    ["/admin/dashboard", t.dashboard],
    ["/admin/rooms", t.rooms],
    ["/admin/residents", t.residents],
    ["/admin/applications", t.applications],
    ["/admin/rent", t.rent],
    ["/admin/payments", t.payments],
    ["/admin/edits", t.editRequests],
    ["/admin/settings", t.settings],
  ] as const;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="border-b border-pine-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-2 font-extrabold text-pine-800">
            {t.admin} · {name}
          </span>
          {tabs.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                pathname === href ? "bg-pine-700 text-white" : "text-pine-800 hover:bg-pine-100"
              }`}
            >
              {label}
            </Link>
          ))}
          <button type="button" onClick={logout} className="ml-auto text-sm font-bold text-slate-500 hover:text-red-700">
            {t.logout}
          </button>
        </div>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
