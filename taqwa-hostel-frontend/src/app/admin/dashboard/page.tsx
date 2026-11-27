/* Admin dashboard — premium refinement, frontend only.
   Every number comes from the EXISTING backend APIs; nothing here is
   sample data and no backend endpoint was added for this round:
   - KPI values, paid amount/count: GET /api/v1/admin/dashboard
   - Rent chart (rent per month): approved payments, grouped by
     payment_date, from GET /api/v1/admin/payments?status=approved
   - New residents per month + Residents sparkline: residents grouped
     by start_date (their joining date), from GET /api/v1/admin/residents
     (page_size=100). Cumulative counts are exact because residents are
     never deleted or deactivated.
   - Rent donut: collected = paid_amount_this_month (live); pending /
     overdue = sums of `remaining` over GET /api/v1/admin/rent/due-list
     by row status. Each open cycle has exactly one status, so a
     partial payment counts only its remaining amount, once.
   - Recent activity: newest residents (start_date) + newest approved
     payments (created_at), merged by date. No phone numbers shown.
   What the existing APIs cannot provide is hidden, not invented:
   - Total Rooms and Vacant Seats have no sparkline (rooms carry no
     created_at); Occupancy has no sparkline (no seats history).
   - Applications do not appear in Recent Activity — the applications
     list does not expose created_at, so their timestamps are unknown.
     Those are backend gaps to add later, not frontend data to fake. */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BedDouble,
  DoorClosed,
  Gauge,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { api, ApiError, formatRs, loadSession, type Page } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, InfoTooltip, MetricCard, Skeleton } from "@/components/ui";

/** Only the fields the existing dashboard API returns today. */
interface DashboardData {
  total_residents: number;
  total_seats: number;
  vacant_seats: number;
  occupied_seats: number;
  total_buildings: number;
  total_rooms: number;
  paid_this_month: number;
  paid_amount_this_month: number;
  due_count: number;
  overdue_count: number;
}

interface MonthPoint {
  key: string;
  label: string;
  rent_collected: number;
  residents_joined: number;
}

/** Due-list row — only the fields the donut sums over. */
interface DueRow {
  remaining: number;
  status: string;
}

/** Approved payment — only the fields the chart/activity use. */
interface PaymentRow {
  id: number;
  full_name: string;
  amount: number;
  payment_date: string | null;
  status: string;
  created_at: string | null;
}

/** Resident summary — only the fields the chart/activity use. */
interface ResidentRow {
  id: number;
  full_name: string;
  start_date: string;
}

type ActivityType = "resident_created" | "payment_approved";

interface ActivityRow {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  at: string;
  href: string;
}

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  resident_created: UserPlus,
  payment_approved: Wallet,
};

/** "10 minutes ago" / "3 hours ago" / "2 days ago" / full date. */
function relativeTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const mins = Math.max(0, Math.floor((Date.now() - at.getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Last 6 calendar months, ending with the current month. */
function lastSixMonths(now: Date): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en", { month: "short" }),
    });
  }
  return out;
}

/** "2026-11-04" → "2026-11" (month key). */
function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Smooth curve (Catmull-Rom → cubic Bezier) through the points. */
function smoothLinePath(xs: number[], ys: number[]): string {
  if (xs.length < 2) return "";
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const p0 = i === 0 ? 0 : i - 1;
    const p1 = i;
    const p2 = i + 1;
    const p3 = Math.min(i + 2, xs.length - 1);
    const c1x = xs[p1] + (xs[p2] - xs[p0]) / 6;
    const c1y = ys[p1] + (ys[p2] - ys[p0]) / 6;
    const c2x = xs[p2] - (xs[p3] - xs[p1]) / 6;
    const c2y = ys[p2] - (ys[p3] - ys[p1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${xs[p2].toFixed(1)},${ys[p2].toFixed(1)}`;
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Performance chart — area chart for rent, bar chart for new         */
/* residents. Real data only (see file header).                       */
/* ------------------------------------------------------------------ */

function PerformanceChart({
  months,
  loading,
  failed,
}: {
  months: MonthPoint[] | null;
  loading: boolean;
  failed: boolean;
}) {
  const [mode, setMode] = useState<"rent" | "residents">("rent");

  if (loading) {
    return (
      <div role="status" aria-label="Loading chart">
        <Skeleton lines={4} />
      </div>
    );
  }
  if (failed) {
    return (
      <p role="status" className="py-10 text-center text-sm text-danger">
        Couldn&apos;t load the chart. Please try again later.
      </p>
    );
  }
  if (!months || months.length === 0) {
    return (
      <p role="status" className="py-10 text-center text-sm text-muted">
        No data in the last 6 months
      </p>
    );
  }

  const values = months.map((m) => (mode === "rent" ? m.rent_collected : m.residents_joined));
  const max = Math.max(1, ...values);
  const allZero = values.every((v) => v === 0);

  const W = 600;
  const H = 180;
  const padX = 10;
  const padTop = 18;
  const padBottom = 30;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const xs = months.map((_, i) => padX + (i * innerW) / Math.max(1, months.length - 1));
  const ys = values.map((v) => padTop + innerH - (v / max) * innerH);
  const line = smoothLinePath(xs, ys);
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${(padTop + innerH).toFixed(1)} L${xs[0].toFixed(1)},${(padTop + innerH).toFixed(1)} Z`;
  const stroke = mode === "rent" ? "#28805A" : "#103D30";
  const highest = months[values.indexOf(Math.max(...values))];
  const lowest = months[values.indexOf(Math.min(...values))];
  const fmt = (v: number) => (mode === "rent" ? formatRs(v) : String(v));
  const fmtShort = (v: number) =>
    mode === "rent" ? (v >= 1000 ? `Rs ${(v / 1000).toFixed(0)}k` : `Rs ${v}`) : String(v);
  const ariaSummary =
    mode === "rent"
      ? `Rent collected over the last 6 months. Highest ${highest.label}, ${formatRs(highest.rent_collected)}. Lowest ${lowest.label}, ${formatRs(lowest.rent_collected)}.`
      : `New residents over the last 6 months. Highest ${highest.label}, ${highest.residents_joined} joined. Lowest ${lowest.label}, ${lowest.residents_joined} joined.`;
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((f) => padTop + innerH - f * innerH);
  const barW = Math.min(44, innerW / months.length / 2);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-btn bg-page p-1" role="group" aria-label="Chart series">
          {(
            [
              { key: "rent", label: "Rent Collected" },
              { key: "residents", label: "New Residents" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              aria-pressed={mode === opt.key}
              onClick={() => setMode(opt.key)}
              className={`h-9 rounded-md px-3 text-sm font-semibold ${
                mode === opt.key ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {allZero ? (
        <p role="status" className="py-10 text-center text-sm text-muted">
          {mode === "rent"
            ? "No collections in the last 6 months"
            : "No new residents in the last 6 months"}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaSummary}
          className="mt-3 w-full"
        >
          <defs>
            <linearGradient id="chartAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridYs.map((y, i) => (
            <g key={y}>
              <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#E2E8E5" strokeWidth="1" />
              <text x={padX} y={y - 4} fontSize="10" fill="#64748B">
                {fmtShort(Math.round(max * [0, 0.25, 0.5, 0.75, 1][i]))}
              </text>
            </g>
          ))}
          {mode === "rent" ? (
            <>
              <path d={area} fill="url(#chartAreaFill)" />
              <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {xs.map((x, i) => (
                <circle key={months[i].label} cx={x} cy={ys[i]} r="4" fill="#FFFFFF" stroke={stroke} strokeWidth="2.5">
                  <title>
                    {months[i].label}: {fmt(values[i])}
                  </title>
                </circle>
              ))}
            </>
          ) : (
            xs.map((x, i) => (
              <g key={months[i].label}>
                <rect
                  x={x - barW / 2}
                  y={ys[i]}
                  width={barW}
                  height={Math.max(0, padTop + innerH - ys[i])}
                  rx="4"
                  fill="#103D30"
                >
                  <title>
                    {months[i].label}: {values[i]} joined
                  </title>
                </rect>
                {values[i] > 0 ? (
                  <text x={x} y={ys[i] - 5} fontSize="11" fontWeight="600" fill="#172B25" textAnchor="middle">
                    {values[i]}
                  </text>
                ) : null}
              </g>
            ))
          )}
          {xs.map((x, i) => (
            <text
              key={months[i].label}
              x={x}
              y={H - 8}
              fontSize="12"
              fill="#64748B"
              textAnchor="middle"
            >
              {months[i].label}
            </text>
          ))}
        </svg>
      )}

      {/* Plain-text values for screen readers (and anyone who wants the numbers). */}
      <ul className="sr-only">
        {months.map((m, i) => (
          <li key={m.label}>
            {m.label}: {fmt(values[i])} {mode === "rent" ? "collected" : "joined"}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        {mode === "rent" ? "From approved payments" : "From resident joining dates"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rent collection donut — live sums (see file header). Collected     */
/* (green) vs pending (amber) vs overdue (red); the collection        */
/* percentage sits inside the donut. Total Expected Rent = collected  */
/* + pending + overdue remaining.                                     */
/* ------------------------------------------------------------------ */

function RentDonut({
  collected,
  pending,
  overdue,
  monthParam,
  loading,
  failed,
}: {
  collected: number;
  pending: number;
  overdue: number;
  monthParam: string;
  loading: boolean;
  failed: boolean;
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading rent collection">
        <Skeleton lines={4} />
      </div>
    );
  }
  if (failed) {
    return (
      <p role="status" className="py-10 text-center text-sm text-danger">
        Couldn&apos;t load rent collection. Please try again later.
      </p>
    );
  }

  const total = collected + pending + overdue;
  const pct = total > 0 ? Math.round((collected / total) * 100) : null;

  const R = 70;
  const C = 2 * Math.PI * R;
  const collectedLen = total > 0 ? (collected / total) * C : 0;
  const pendingLen = total > 0 ? (pending / total) * C : 0;
  const overdueLen = total > 0 ? (overdue / total) * C : 0;

  const legendRow =
    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-ink hover:bg-page";

  return (
    <div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <svg
          viewBox="0 0 180 180"
          role="img"
          aria-label={
            total > 0
              ? `${pct}% of rent collected this month — ${formatRs(collected)} of ${formatRs(total)} total expected.`
              : "No rent due this month"
          }
          className="h-44 w-44 shrink-0"
        >
          <circle cx="90" cy="90" r={R} fill="none" stroke="#E2E8E5" strokeWidth="22" />
          {total > 0 && overdueLen > 0 ? (
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke="#DC2626"
              strokeWidth="22"
              strokeDasharray={`${overdueLen} ${C - overdueLen}`}
              strokeDashoffset={-(collectedLen + pendingLen)}
              transform="rotate(-90 90 90)"
            />
          ) : null}
          {total > 0 && pendingLen > 0 ? (
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke="#B78119"
              strokeWidth="22"
              strokeDasharray={`${pendingLen} ${C - pendingLen}`}
              strokeDashoffset={-collectedLen}
              transform="rotate(-90 90 90)"
            />
          ) : null}
          {total > 0 && collectedLen > 0 ? (
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke="#28805A"
              strokeWidth="22"
              strokeDasharray={`${collectedLen} ${C - collectedLen}`}
              transform="rotate(-90 90 90)"
            />
          ) : null}
          <text x="90" y="88" textAnchor="middle" fontSize="26" fontWeight="700" fill="#172B25">
            {pct === null ? "—" : `${pct}%`}
          </text>
          <text x="90" y="108" textAnchor="middle" fontSize="12" fill="#64748B">
            {pct === null ? "No rent due" : "collected"}
          </text>
        </svg>

        <div className="w-full min-w-0 flex-1 divide-y divide-line">
          <Link href={`/admin/payments?status=approved&month=${monthParam}`} className={legendRow}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-success" aria-hidden />
              Collected
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{formatRs(collected)}</span>
          </Link>
          <div className="flex items-center justify-between gap-2">
            <Link href="/admin/rent?status=due" className={`${legendRow} flex-1`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm bg-warning" aria-hidden />
                Pending
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatRs(pending)}</span>
            </Link>
            <InfoTooltip
              text="Pending is the sum of what is still owed on open rent cycles that are due but not yet overdue. A partial payment counts only the amount still owed."
              label="About pending rent"
            />
          </div>
          <Link
            href="/admin/rent?status=overdue"
            className={`${legendRow} ${overdue > 0 ? "text-danger" : "text-muted"}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-danger" aria-hidden />
              {overdue > 0 ? "Overdue" : "No overdue rent — all clear"}
            </span>
            {overdue > 0 ? (
              <span className="shrink-0 font-semibold tabular-nums">{formatRs(overdue)}</span>
            ) : (
              <span aria-hidden>→</span>
            )}
          </Link>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-2 pt-2.5 text-sm">
            <span className="font-semibold text-ink">Total Expected Rent</span>
            <span className="font-semibold tabular-nums text-ink">{formatRs(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard page                                                      */
/* ------------------------------------------------------------------ */

export default function AdminDashboardPage() {
  const { t } = useLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [adminName, setAdminName] = useState("");
  const [dueRows, setDueRows] = useState<DueRow[] | null>(null);
  const [dueFailed, setDueFailed] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [paymentsFailed, setPaymentsFailed] = useState(false);
  const [residents, setResidents] = useState<ResidentRow[] | null>(null);
  const [residentsFailed, setResidentsFailed] = useState(false);

  useEffect(() => {
    api<DashboardData>("/api/v1/admin/dashboard", { auth: true })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.tryAgain));
    api<{ full_name: string }>("/api/v1/auth/me", { auth: true })
      .then((me) => setAdminName(me.full_name))
      .catch(() => setAdminName(loadSession()?.fullName ?? ""));
    api<DueRow[]>("/api/v1/admin/rent/due-list?status=all", { auth: true })
      .then(setDueRows)
      .catch(() => setDueFailed(true));
    api<PaymentRow[]>("/api/v1/admin/payments?status=approved", { auth: true })
      .then(setPayments)
      .catch(() => setPaymentsFailed(true));
    api<Page<ResidentRow>>("/api/v1/admin/residents?page=1&page_size=100", { auth: true })
      .then((page) => setResidents(page.items ?? []))
      .catch(() => setResidentsFailed(true));
  }, [t]);

  // Occupancy is undefined when no seats exist at all — the card shows
  // an explicit empty state instead of a misleading "0%".
  const occupancy =
    data && data.total_seats > 0
      ? Math.round((data.occupied_seats / data.total_seats) * 100)
      : null;

  const now = new Date();
  const monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const greeting = greetingFor(now.getHours());
  const months = lastSixMonths(now);

  // Monthly series from the live lists. Null until both lists arrive.
  const chartMonths: MonthPoint[] | null =
    payments && residents
      ? months.map((m) => ({
          key: m.key,
          label: m.label,
          rent_collected: payments
            .filter((p) => p.status === "approved" && monthKey(p.payment_date) === m.key)
            .reduce((sum, p) => sum + p.amount, 0),
          residents_joined: residents.filter((r) => monthKey(r.start_date) === m.key).length,
        }))
      : null;
  const chartFailed = paymentsFailed || residentsFailed;

  // Cumulative residents per month-end — exact only when the fetched
  // list holds every resident (page_size=100 cap). Otherwise hidden.
  const residentsComplete = Boolean(
    data && residents && residents.length >= data.total_residents
  );
  const residentsSparkline: number[] | undefined = residentsComplete
    ? months.map((m) => {
        const [y, mo] = m.key.split("-").map(Number);
        const monthEnd = new Date(y, mo, 0); // last day of that month
        return residents!.filter((r) => {
          const d = new Date(r.start_date);
          return !Number.isNaN(d.getTime()) && d <= monthEnd;
        }).length;
      })
    : undefined;
  const newThisMonth = residents
    ? residents.filter((r) => monthKey(r.start_date) === monthParam).length
    : 0;

  // Donut sums: each open cycle has exactly one status, so pending and
  // overdue can never double-count the same cycle. A partial payment
  // counts only its remaining amount, in the bucket its status puts it.
  const pendingAmount = dueRows
    ? dueRows.filter((r) => r.status !== "overdue").reduce((sum, r) => sum + r.remaining, 0)
    : 0;
  const overdueAmount = dueRows
    ? dueRows.filter((r) => r.status === "overdue").reduce((sum, r) => sum + r.remaining, 0)
    : 0;

  // Recent activity: newest residents + newest approved payments,
  // merged by date. Applications are excluded — their list has no
  // created_at, so their timestamps are unknown (see file header).
  const activity: ActivityRow[] | null =
    payments && residents
      ? [
          ...residents.map((r): ActivityRow => ({
            id: `resident-${r.id}`,
            type: "resident_created",
            title: `New resident added: ${r.full_name}`,
            detail: `Joined ${new Date(r.start_date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`,
            at: r.start_date,
            href: `/admin/residents?search=${encodeURIComponent(r.full_name)}`,
          })),
          ...payments
            .filter((p) => p.status === "approved" && p.created_at)
            .map((p): ActivityRow => ({
              id: `payment-${p.id}`,
              type: "payment_approved",
              title: `Rent payment received: ${formatRs(p.amount)}`,
              detail: p.full_name,
              at: p.created_at as string,
              href: "/admin/payments?status=approved",
            })),
        ]
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          .slice(0, 5)
      : null;

  const kpis: {
    icon: LucideIcon;
    label: string;
    value: string | number;
    sub?: string;
    href?: string;
    sparkline?: number[];
    extra?: ReactNode;
  }[] = data
    ? [
        {
          icon: Users,
          label: t.totalResidents,
          value: data.total_residents,
          sub: residents ? `${newThisMonth} new this month` : undefined,
          href: "/admin/residents",
          sparkline: residentsSparkline,
        },
        {
          icon: BedDouble,
          label: t.vacantSeats,
          value: data.vacant_seats,
          sub:
            data.total_seats > 0
              ? `${Math.round((data.vacant_seats / data.total_seats) * 100)}% of all seats`
              : "No seats added yet",
          href: "/admin/rooms?availability=vacant",
        },
        {
          icon: DoorClosed,
          label: "Total rooms",
          value: data.total_rooms,
          sub: `${data.total_buildings} building${data.total_buildings === 1 ? "" : "s"}`,
          href: "/admin/rooms",
        },
        {
          icon: Gauge,
          label: "Occupancy rate",
          value: occupancy === null ? "—" : `${occupancy}%`,
          sub:
            occupancy === null
              ? "No seats added yet"
              : `${data.occupied_seats} of ${data.total_seats} seats`,
          extra:
            occupancy === null ? undefined : (
              <div
                className="h-2 w-full overflow-hidden rounded-lg bg-line"
                role="progressbar"
                aria-valuenow={occupancy}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Occupancy ${occupancy} percent`}
              >
                <div className="h-full rounded-lg bg-brand" style={{ width: `${occupancy}%` }} />
              </div>
            ),
        },
      ]
    : [];

  return (
    <AdminShell>
      <div className="mb-6 rounded-card bg-gradient-to-r from-brand via-[#155C43] to-[#1E6B4F] px-5 py-5 text-white shadow-card sm:px-6">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-white sm:text-2xl">
          {greeting}
          {adminName ? `, ${adminName}` : ""}
        </h1>
        <p className="mt-0.5 text-sm text-white/75">
          Here&apos;s a quick overview of Taqwa Boys Hostel.
        </p>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {!data && !error ? (
        <div role="status" aria-label={t.loading}>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton lines={3} />
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            {[0, 1].map((i) => (
              <Card key={i} className={`p-4 ${i === 0 ? "lg:col-span-3" : "lg:col-span-2"}`}>
                <Skeleton lines={4} />
              </Card>
            ))}
          </div>
          <Card className="mt-4 p-4">
            <Skeleton lines={3} />
          </Card>
        </div>
      ) : null}

      {data ? (
        <>
          <section aria-label="Hostel overview" className="mb-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((m) => (
                <MetricCard
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
                  value={m.value}
                  sub={m.sub}
                  href={m.href}
                  sparkline={m.sparkline}
                  extra={m.extra}
                />
              ))}
            </div>
          </section>

          <section aria-label="Rent chart and collection" className="mb-6 grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <h2 className="mb-1 text-lg font-semibold text-ink">Performance Overview</h2>
              <p className="mb-3 text-sm text-muted">Last 6 months</p>
              <PerformanceChart
                months={chartMonths}
                loading={!payments || !residents}
                failed={chartFailed}
              />
            </Card>

            <Card className="lg:col-span-2">
              <h2 className="mb-1 text-lg font-semibold text-ink">Rent Collection</h2>
              <p className="mb-3 text-sm text-muted">This month</p>
              <RentDonut
                collected={data.paid_amount_this_month}
                pending={pendingAmount}
                overdue={overdueAmount}
                monthParam={monthParam}
                loading={!dueRows}
                failed={dueFailed}
              />
            </Card>
          </section>

          <section aria-label="Recent activity">
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-ink">Recent Activity</h2>
              {!activity ? (
                chartFailed ? (
                  <p role="status" className="py-6 text-center text-sm text-danger">
                    Couldn&apos;t load recent activity. Please try again later.
                  </p>
                ) : (
                  <div role="status" aria-label="Loading recent activity">
                    <Skeleton lines={3} />
                  </div>
                )
              ) : activity.length === 0 ? (
                <p role="status" className="py-6 text-center text-sm text-muted">
                  No recent activity yet
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {activity.map((item) => {
                    const Icon = ACTIVITY_ICON[item.type];
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-active text-brand">
                            <Icon className="h-[18px] w-[18px]" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {item.title}
                            </span>
                            <span className="block truncate text-xs text-muted">{item.detail}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted">{relativeTime(item.at)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
