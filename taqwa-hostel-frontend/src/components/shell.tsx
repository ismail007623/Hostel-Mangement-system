"use client";

/**
 * Shared portal shell layout (admin + resident).
 * Full-height app shell (100dvh, no document-level scrolling): the
 * sidebar is 248px with branding fixed at the top, an independently
 * scrolling nav, and the profile anchored at the bottom; the main
 * content scrolls on its own under a fixed 64px global header.
 * Admin header: only "Hostel Admin" on the left and a Sign out
 * button on the right. Resident header keeps the breadcrumb and the
 * Urdu toggle. No search, bell, or font-size control in any header —
 * language is set in Admin Settings → Preferences, and the large-text
 * control was removed at Ismail's request (27 Nov 2026) and must not
 * come back. Mobile: drawer nav.
 * No session is read here during render; the calling shell verifies
 * the role via /me in useEffect before rendering this layout.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { logout } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface ShellNavGroup {
  label: string;
  items: ShellNavItem[];
}

function SidebarContent({
  groups,
  name,
  roleLabel,
  onNavigate,
}: {
  groups: ShellNavGroup[];
  name: string;
  roleLabel: string;
  onNavigate: () => void;
}) {
  const { t } = useLang();
  const pathname = usePathname();
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-lg font-semibold text-white">
            T
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold text-ink">Taqwa Boys Hostel</span>
          </span>
        </div>
      </div>

      <nav className="sidebar-nav mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label={roleLabel}>
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
            <ul className="grid gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                        active ? "bg-active text-brand" : "text-ink hover:bg-page"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto shrink-0 border-t border-line p-3">
        <DropdownMenu
          label={t.logout}
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-page"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-active text-sm font-semibold text-brand">
                {initials || "?"}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                <span className="block truncate text-xs text-muted">{roleLabel}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </button>
          }
        >
          <DropdownMenuItem onSelect={logout} danger icon={LogOut}>
            {t.logout}
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </div>
  );
}


export function ShellLayout({
  title,
  groups,
  name,
  roleLabel,
  children,
  isAdmin = false,
}: {
  title: string;
  groups: ShellNavGroup[];
  name: string;
  roleLabel: string;
  children: ReactNode;
  /** Admin shell: header is "Hostel Admin" + Sign out, no breadcrumb,
      search, bell, or language switch (language lives in Settings).
      Resident shell: breadcrumb + Urdu toggle, as before. */
  isAdmin?: boolean;
}) {
  const { t, lang, setLang } = useLang();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-page">
      {/* Desktop sidebar — 248px, full viewport height (100dvh) */}
      <aside className="hidden h-dvh w-[248px] shrink-0 border-e border-line bg-white md:block">
        <SidebarContent groups={groups} name={name} roleLabel={roleLabel} onNavigate={() => undefined} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex h-dvh w-[248px] flex-col bg-white shadow-modal rtl:left-auto rtl:right-0">
            <div className="flex shrink-0 justify-end p-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-btn text-ink hover:bg-page"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarContent groups={groups} name={name} roleLabel={roleLabel} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-btn text-ink hover:bg-page md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          {isAdmin ? (
            <>
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
                Hostel Admin
              </span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-btn border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {t.logout}
              </button>
            </>
          ) : (
            <>
              <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                  <li className="shrink-0 text-muted">{roleLabel}</li>
                  <li aria-hidden="true" className="shrink-0 text-muted">
                    /
                  </li>
                  <li className="truncate font-semibold text-ink">{title}</li>
                </ol>
              </nav>
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "ur" : "en")}
                className="inline-flex h-10 shrink-0 items-center rounded-btn bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                {lang === "en" ? "اردو" : "English"}
              </button>
            </>
          )}
        </header>
        <div className="main-scroll min-h-0 flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-6xl px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
