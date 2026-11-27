/* Resident area shell: only a logged-in resident may enter.
   Role is verified with the backend (/me), not trusted from storage.
   The resident portal has its OWN sidebar with ONLY resident items
   (Home, Pay, History, Profile, Logout) — no public nav.
   A resident only ever sees their own data — every resident endpoint
   takes the resident id from the JWT. Urdu toggle lives in the
   header (see src/components/shell.tsx). */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { History, Home, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { api, loadSession } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Loading } from "@/components/ui";
import { ShellLayout, type ShellNavGroup } from "@/components/shell";

export function ResidentShell({ children }: { children: ReactNode }) {
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

  const titles: Record<string, string> = {
    "/resident/home": t.home,
    "/resident/pay": t.payRent,
    "/resident/history": t.rentHistory,
    "/resident/profile": t.editProfile,
  };
  const title = titles[pathname] ?? t.resident;

  const iconFor: Record<string, LucideIcon> = {
    "/resident/home": Home,
    "/resident/pay": Wallet,
    "/resident/history": History,
    "/resident/profile": UserRound,
  };
  const item = (href: string): { href: string; label: string; icon: LucideIcon } => ({
    href,
    label: titles[href] ?? href,
    icon: iconFor[href] ?? Home,
  });

  const groups: ShellNavGroup[] = [
    {
      label: t.resident,
      items: [item("/resident/home"), item("/resident/pay"), item("/resident/history"), item("/resident/profile")],
    },
  ];

  return (
    <ShellLayout title={title} groups={groups} name={name} roleLabel={t.resident}>
      {children}
    </ShellLayout>
  );
}
