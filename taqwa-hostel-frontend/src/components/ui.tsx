import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-pine-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  );
}

export function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-extrabold text-pine-800 sm:text-3xl">{title}</h2>
      {sub ? <p className="mt-2 max-w-2xl text-slate-600">{sub}</p> : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  approved: "bg-green-100 text-green-800",
  due: "bg-yellow-100 text-yellow-800",
  due_soon: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  active: "bg-green-100 text-green-800",
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function Loading({ label }: { label: string }) {
  return <p className="py-10 text-center text-slate-500">{label}</p>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
      {message}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-pine-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none focus:border-pine-700 focus:ring-2 focus:ring-pine-100";

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
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-pine-700 px-5 py-3 text-base font-bold text-white shadow hover:bg-pine-800 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold text-pine-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
