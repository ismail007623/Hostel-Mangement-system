/* Admin area shell: only a logged-in admin may enter.
   Role is verified with the backend (/me), not trusted from storage.
   The admin area has its OWN sidebar with ONLY admin items — no
   public website nav here. Urdu toggle + A+ large-text toggle live
   in the sidebar (see src/components/shell.tsx). */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  FileEdit,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api, loadSession } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Loading } from "@/components/ui";
import { ShellLayout, type ShellNavGroup } from "@/components/shell";

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

  const titles: Record<string, string> = {
    "/admin/dashboard": t.dashboard,
    "/admin/rooms": t.rooms,
    "/admin/residents": t.residents,
    "/admin/applications": t.applications,
    "/admin/rent": t.rent,
    "/admin/payments": t.payments,
    "/admin/edits": t.editRequests,
    "/admin/settings": t.settings,
  };
  const title = titles[pathname] ?? t.admin;

  const iconFor: Record<string, LucideIcon> = {
    "/admin/dashboard": LayoutDashboard,
    "/admin/rooms": Building2,
    "/admin/residents": Users,
    "/admin/applications": FileText,
    "/admin/rent": Wallet,
    "/admin/payments": Receipt,
    "/admin/edits": FileEdit,
    "/admin/settings": Settings,
  };
  const item = (href: string): { href: string; label: string; icon: LucideIcon } => ({
    href,
    label: titles[href] ?? href,
    icon: iconFor[href] ?? LayoutDashboard,
  });

  const groups: ShellNavGroup[] = [
    { label: "Overview", items: [item("/admin/dashboard")] },
    {
      label: "Management",
      items: [item("/admin/rooms"), item("/admin/residents"), item("/admin/applications")],
    },
    { label: "Finance", items: [item("/admin/rent"), item("/admin/payments")] },
    { label: "Preferences", items: [item("/admin/edits"), item("/admin/settings")] },
  ];

  return (
    <ShellLayout title={title} groups={groups} name={name} roleLabel={t.admin}>
      {children}
    </ShellLayout>
  );
}
