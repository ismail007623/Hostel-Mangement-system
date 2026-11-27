"use client";

/**
 * Shared portal shell layout (admin + resident).
 * Sidebar 248px, branding at top, grouped nav, profile dropdown with
 * Logout at the bottom. Mobile: drawer navigation. The top header
 * shows the current page title plus the language switcher and the
 * existing A+ large-text control (from useLang — RTL + large-text
 * behaviour is unchanged, see src/lib/i18n.tsx).
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
  const { t, lang, setLang, largeText, setLargeText } = useLang();
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
      <div className="px-4 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-lg font-semibold text-white">
            T
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold text-ink">Taqwa Boys Hostel</span>
            <span className="block truncate text-xs text-muted">
              {roleLabel} · {name}
            </span>
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setLargeText(!largeText)}
            aria-pressed={largeText}
            title={t.largeText}
            className={`h-10 flex-1 rounded-btn border text-sm font-semibold ${
              largeText ? "border-brand bg-active text-brand" : "border-line bg-white text-ink"
            }`}
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            className="h-10 flex-1 rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-800"
          >
            {lang === "en" ? "اردو" : "English"}
          </button>
        </div>
      </div>

      <nav className="mt-6 flex-1 overflow-y-auto px-3 pb-4" aria-label={roleLabel}>
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

      <div className="border-t border-line p-3">
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
}: {
  title: string;
  groups: ShellNavGroup[];
  name: string;
  roleLabel: string;
  children: ReactNode;
}) {
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
    <div className="flex min-h-screen bg-page">
      {/* Desktop sidebar — 248px */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-e border-line bg-white md:block">
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
          <aside className="absolute inset-y-0 left-0 w-[248px] bg-white shadow-modal rtl:left-auto rtl:right-0">
            <div className="flex justify-end p-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-btn text-ink hover:bg-page"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="h-[calc(100%-52px)]">
              <SidebarContent groups={groups} name={name} roleLabel={roleLabel} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-btn text-ink hover:bg-page md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="truncate text-lg font-semibold text-ink">{title}</h1>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
