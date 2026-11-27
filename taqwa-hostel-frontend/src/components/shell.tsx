"use client";

/**
 * Shared portal shell layout (admin + resident).
 * Full-height app shell (100dvh, no document-level scrolling): the
 * sidebar is 248px with branding fixed at the top, an independently
 * scrolling nav, and the profile anchored at the bottom; the main
 * content scrolls on its own under a fixed global header. The header
 * shows a compact breadcrumb plus the language switcher and the
 * existing A+ large-text control (from useLang — RTL + large-text
 * behaviour is unchanged, see src/lib/i18n.tsx). The admin shell
 * additionally shows a residents search box (Cmd/Ctrl+K focuses it,
 * Enter routes to /admin/residents?search=) and a pending-work bell
 * whose badge is pending payments + pending applications — STATIC
 * sample counts for now (src/lib/staticPreview.ts), hidden when 0;
 * both are admin-only and never render in the
 * resident shell. Mobile: drawer nav.
 * No session is read here during render; the calling shell verifies
 * the role via /me in useEffect before rendering this layout.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
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

export interface PendingWorkCounts {
  payments: number;
  applications: number;
}

const RESIDENT_SEARCH_PLACEHOLDER = "Search residents by name, phone or CNIC...";

/**
 * Admin-only header search. Enter routes to the residents list with
 * ?search= (the residents page reads that param); an empty query just
 * opens the residents list. Cmd/Ctrl+K focuses the desktop input.
 * Rendered twice (desktop inline, mobile expanded row) sharing one
 * query — the two inputs never show at the same viewport width.
 */
function ResidentSearchBox({
  query,
  onQueryChange,
  onSubmit,
  inputRef,
  autoFocus = false,
  className = "",
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={RESIDENT_SEARCH_PLACEHOLDER}
        aria-label="Search residents by name, phone or CNIC"
        className="h-10 w-full rounded-btn border border-line bg-white pl-9 pr-12 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand-50"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-page px-1.5 py-0.5 text-[11px] font-semibold text-muted md:block">
        ⌘K
      </kbd>
    </form>
  );
}

/**
 * Admin-only pending-work bell. The badge is the number of payments
 * awaiting approval plus applications awaiting review — STATIC sample
 * counts for now (AdminShell passes them from staticPreview); it is
 * hidden when the total is 0. The panel lists the two destinations —
 * never called notifications.
 */
function PendingWorkBell({ counts }: { counts: PendingWorkCounts }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const total = counts.payments + counts.applications;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Pending work"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-btn border border-line bg-white text-ink hover:bg-page"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          aria-label="Pending work"
          className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-white p-1 shadow-modal rtl:left-0 rtl:right-auto"
        >
          {total === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">Nothing waiting for you</p>
          ) : (
            <>
              <Link
                href="/admin/payments?status=pending"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-page"
              >
                <span>
                  {counts.payments} payment{counts.payments === 1 ? "" : "s"} awaiting approval
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
              <Link
                href="/admin/applications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-page"
              >
                <span>
                  {counts.applications} application{counts.applications === 1 ? "" : "s"} awaiting
                  review
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ShellLayout({
  title,
  groups,
  name,
  roleLabel,
  children,
  showResidentSearch = false,
  pendingCounts = null,
}: {
  title: string;
  groups: ShellNavGroup[];
  name: string;
  roleLabel: string;
  children: ReactNode;
  /** Admin shell only: header search for residents. Never set for residents. */
  showResidentSearch?: boolean;
  /** Admin shell only: pending-work counts for the header bell. Null hides the bell (not loaded / failed). */
  pendingCounts?: PendingWorkCounts | null;
}) {
  const { t, lang, setLang, largeText, setLargeText } = useLang();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const submitResidentSearch = () => {
    const q = searchQuery.trim();
    setMobileSearchOpen(false);
    router.push(q ? `/admin/residents?search=${encodeURIComponent(q)}` : "/admin/residents");
  };

  useEffect(() => {
    if (!showResidentSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (mobileSearchOpen) mobileSearchRef.current?.focus();
        else desktopSearchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showResidentSearch, mobileSearchOpen]);

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
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-btn text-ink hover:bg-page md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              <li className="shrink-0 text-muted">{roleLabel}</li>
              <li aria-hidden="true" className="shrink-0 text-muted">
                /
              </li>
              <li className="truncate font-semibold text-ink">{title}</li>
            </ol>
          </nav>
          {showResidentSearch ? (
            <>
              <ResidentSearchBox
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSubmit={submitResidentSearch}
                inputRef={desktopSearchRef}
                className="hidden w-64 shrink-0 md:block lg:w-80"
              />
              <button
                type="button"
                aria-label="Search residents"
                aria-expanded={mobileSearchOpen}
                onClick={() => setMobileSearchOpen((v) => !v)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-line bg-white text-ink hover:bg-page md:hidden"
              >
                <Search className="h-5 w-5" aria-hidden />
              </button>
            </>
          ) : null}
          <div className="flex shrink-0 items-center gap-2">
            {pendingCounts ? <PendingWorkBell counts={pendingCounts} /> : null}
            <button
              type="button"
              onClick={() => setLargeText(!largeText)}
              aria-pressed={largeText}
              title={t.largeText}
              className={`inline-flex h-10 items-center rounded-btn border px-3 text-sm font-semibold ${
                largeText ? "border-brand bg-active text-brand" : "border-line bg-white text-ink"
              }`}
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "ur" : "en")}
              className="inline-flex h-10 items-center rounded-btn bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {lang === "en" ? "اردو" : "English"}
            </button>
          </div>
          {showResidentSearch && mobileSearchOpen ? (
            <ResidentSearchBox
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSubmit={submitResidentSearch}
              inputRef={mobileSearchRef}
              autoFocus
              className="w-full md:hidden"
            />
          ) : null}
        </header>
        <div className="main-scroll min-h-0 flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
