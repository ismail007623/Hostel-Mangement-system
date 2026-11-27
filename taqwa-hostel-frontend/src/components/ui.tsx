"use client";

/**
 * Shared UI primitives — Taqwa frontend redesign (foundation).
 * All components use the new tokens (brand #103D30, active #E8F2EC,
 * page #F7F8FA, line #E2E8E5, ink #172B25, muted #64748B,
 * success #28805A, warning #B78119, danger #DC2626) and Lucide icons
 * (no emoji). Buttons are 40-44px high, radius 8px; inputs 44px;
 * cards radius 12px, padding 20-24px; modals radius 16px.
 * Only the primary button is visually dominant.
 */

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-white p-5 shadow-card sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SectionTitle — page heading (28-30px semibold)                     */
/* ------------------------------------------------------------------ */

export function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-success">{eyebrow}</p>
      <h2 className="mt-1 text-[28px] font-semibold leading-tight text-ink sm:text-[30px]">{title}</h2>
      {sub ? <p className="mt-2 max-w-2xl text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatusBadge / StatusPill (kept name — pages import StatusPill)     */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-active text-brand",
  approved: "bg-active text-brand",
  active: "bg-active text-brand",
  vacant: "bg-active text-brand",
  due: "bg-amber-50 text-warning",
  due_soon: "bg-amber-50 text-warning",
  pending: "bg-amber-50 text-warning",
  overdue: "bg-red-50 text-danger",
  rejected: "bg-red-50 text-danger",
  inactive: "bg-slate-100 text-muted",
  occupied: "bg-slate-100 text-muted",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-muted";
  return (
    <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

/** Backwards-compatible name — existing pages import `StatusPill`. */
export const StatusPill = StatusBadge;

/* ------------------------------------------------------------------ */
/* Loading / ErrorBox                                                  */
/* ------------------------------------------------------------------ */

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 p-4 text-sm font-semibold text-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field + inputCls (kept — pages use them with raw inputs/selects)    */
/* ------------------------------------------------------------------ */

export const inputCls =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand-50 disabled:bg-slate-50 disabled:text-muted";

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-800 disabled:bg-brand/60",
  secondary: "border border-line bg-white text-ink hover:bg-page disabled:text-muted",
  tertiary: "bg-active text-brand hover:bg-brand-100 disabled:text-muted",
  destructive: "bg-danger text-white hover:bg-red-700 disabled:bg-danger/60",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: LucideIcon;
}

export function Button({
  variant = "primary",
  loading = false,
  icon: Icon,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-btn px-4 text-sm font-semibold transition-colors focus-visible:outline-2 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** Kept for existing pages: a primary submit button. */
export function PrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <Button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-btn border border-line bg-white text-ink hover:bg-page disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Input / Select (44px, labelled, error + helper text)                */
/* ------------------------------------------------------------------ */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, id, className = "", ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <span className="block">
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-hint` : undefined}
        className={`${inputCls} ${error ? "border-danger focus:border-danger focus:ring-red-100" : ""} ${className}`}
        {...rest}
      />
      {error ? (
        <span id={`${inputId}-error`} className="mt-1 block text-xs font-medium text-danger">
          {error}
        </span>
      ) : helperText ? (
        <span id={`${inputId}-hint`} className="mt-1 block text-xs text-muted">
          {helperText}
        </span>
      ) : null}
    </span>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, helperText, id, options, children, className = "", ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <span className="block">
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}
      <span className="relative block">
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={`${inputCls} appearance-none pr-10 ${error ? "border-danger focus:border-danger focus:ring-red-100" : ""} ${className}`}
          {...rest}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      </span>
      {error ? (
        <span className="mt-1 block text-xs font-medium text-danger">{error}</span>
      ) : helperText ? (
        <span className="mt-1 block text-xs text-muted">{helperText}</span>
      ) : null}
    </span>
  );
});

/* ------------------------------------------------------------------ */
/* Modal — radius 16px, fixed header + optional footer, Escape /      */
/* backdrop close, autofocus first field, focus returned on close.     */
/* ------------------------------------------------------------------ */

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("input, select, textarea, button:not([aria-label='Close'])");
    (first ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-modal bg-white shadow-modal ${
          size === "lg" ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <IconButton label="Close" icon={X} onClick={onClose} aria-label="Close" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ConfirmDialog — destructive / sensitive actions                     */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink">{message}</p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* DropdownMenu — three-dot action menus, keyboard navigable           */
/* ------------------------------------------------------------------ */

export function DropdownMenuItem({
  onSelect,
  danger = false,
  disabled = false,
  icon: Icon,
  children,
}: {
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-page disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function DropdownMenu({
  trigger,
  label,
  children,
  align = "right",
}: {
  trigger: ReactNode;
  label: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]:not(:disabled)") ?? []
        );
        if (!items.length) return;
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={label}>
        {trigger}
      </div>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={`absolute z-50 mt-2 min-w-44 rounded-card border border-line bg-white p-1 shadow-modal ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export function Pagination({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total?: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1 && total === undefined) return null;
  const start = Math.max(1, Math.min(page - 2, Math.max(1, pages - 4)));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i).filter((n) => n <= pages);
  const btn =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-btn border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? "page" : undefined}
          onClick={() => onPage(n)}
          className={`${btn} ${n === page ? "border-brand bg-active text-brand" : ""}`}
        >
          {n}
        </button>
      ))}
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      {total !== undefined ? (
        <span className="ml-1 text-xs text-muted">
          Page {page} of {pages} · {total} total
        </span>
      ) : null}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState / Skeleton                                               */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-line bg-white px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-card bg-active text-brand">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "", lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div aria-hidden className={className}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="mb-2 h-4 animate-pulse rounded bg-slate-200 last:mb-0" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast — lightweight custom implementation, no new dependency.       */
/* Mount <ToastProvider> once in the root layout.                      */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}
interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastCtx>({
  toast: () => undefined,
  success: () => undefined,
  error: () => undefined,
});

export function useToast(): ToastCtx {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const value: ToastCtx = {
    toast,
    success: (m: string) => toast(m, "success"),
    error: (m: string) => toast(m, "error"),
  };
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-2 rounded-card border border-line bg-white p-3 text-sm font-medium text-ink shadow-modal"
          >
            {t.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* InfoTooltip — keyboard-accessible definition tooltip. Shows on      */
/* hover AND focus (not just the `title` attribute, which keyboard     */
/* users and touch users never see).                                   */
/* ------------------------------------------------------------------ */

export function InfoTooltip({ text, label = "More info" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-page hover:text-ink"
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className="absolute right-0 top-7 z-50 w-56 rounded-lg border border-line bg-white p-2.5 text-left text-xs font-normal leading-relaxed text-ink shadow-modal rtl:left-0 rtl:right-auto"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* MetricCard — label + icon at the top, value below, optional sub.    */
/* `tone` colours the value (and icon tint) for financial status:      */
/* success = paid, warning = due, danger = overdue.                    */
/* `href` makes the card a stretched-link card: the whole card         */
/* navigates, with a subtle arrow, hover tint, and a visible focus     */
/* ring. The link is an empty absolute <a> that is a SIBLING of the    */
/* InfoTooltip button — never a parent — so no interactive element     */
/* is ever nested inside another, and the tooltip never triggers       */
/* navigation. `extra` renders extra content below the sub (e.g. a    */
/* progress bar).                                                       */
/* ------------------------------------------------------------------ */

export type MetricTone = "default" | "success" | "warning" | "danger";

const METRIC_TONE_VALUE: Record<MetricTone, string> = {
  default: "text-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const METRIC_TONE_ICON: Record<MetricTone, string> = {
  default: "bg-active text-brand",
  success: "bg-active text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-danger",
};

/** Compact sparkline (SVG polyline). Hidden when fewer than 2 points. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const W = 76;
  const H = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i * (W - 4)) / (values.length - 1) + 2;
    const y = H - 3 - ((v - min) / span) * (H - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="#28805A"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3" fill="#28805A" />
    </svg>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tooltip,
  tone = "default",
  href,
  hrefLabel,
  extra,
  sparkline,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
  tooltip?: string;
  tone?: MetricTone;
  href?: string;
  hrefLabel?: string;
  extra?: ReactNode;
  /** Real historical values for the top-right sparkline. Omit when
      no history exists — no trend is shown rather than a made-up one. */
  sparkline?: number[];
}) {
  const clickable = Boolean(href);
  return (
    <Card
      className={`relative flex h-full flex-col p-4 ${
        clickable
          ? "group transition-all duration-150 hover:-translate-y-0.5 hover:border-brand/50 hover:bg-active/50 hover:shadow-[0_14px_30px_-14px_rgba(16,61,48,0.35)] motion-reduce:transform-none motion-reduce:transition-none"
          : ""
      }`}
    >
      {href ? (
        <Link
          href={href}
          aria-label={hrefLabel ?? `View ${label}`}
          className="absolute inset-0 z-10 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        />
      ) : null}
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${METRIC_TONE_ICON[tone]}`}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {sparkline ? <Sparkline values={sparkline} label={`${label} trend`} /> : null}
            {tooltip ? (
              <span className="relative z-20">
                <InfoTooltip text={tooltip} label={`About ${label}`} />
              </span>
            ) : null}
            {clickable ? <ArrowUpRight className="h-4 w-4 text-muted" aria-hidden /> : null}
          </span>
        </div>
        <p className={`mt-3 text-[28px] font-semibold leading-none tracking-tight ${METRIC_TONE_VALUE[tone]}`}>{value}</p>
        <p className="mt-1.5 text-sm font-semibold text-ink">{label}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
        {extra ? <div className="mt-3">{extra}</div> : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* DataTable primitives — scroll container never causes page-level     */
/* horizontal overflow (page itself keeps overflow-x hidden).          */
/* ------------------------------------------------------------------ */

export function TableContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-card border border-line bg-white shadow-card ${className}`}>{children}</div>
  );
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={`w-full min-w-[560px] border-collapse text-left text-sm ${className}`}>{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 bg-white">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-t border-line first:border-t-0 hover:bg-page ${className}`}>{children}</tr>;
}

export function TableHeadCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top text-ink ${className}`}>{children}</td>;
}

/** Convenience wrapper: scroll container + table in one. */
export function DataTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <TableContainer className={className}>
      <Table>{children}</Table>
    </TableContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar — search input + filters row that wraps                     */
/* ------------------------------------------------------------------ */

export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

export function SearchInput({
  label = "Search",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <span className="relative block w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" aria-label={label} placeholder={label} className={`${inputCls} pl-9`} {...rest} />
    </span>
  );
}
