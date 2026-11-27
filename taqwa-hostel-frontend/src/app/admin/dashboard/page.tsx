/* Admin dashboard — static interim version.
   LIVE from the existing dashboard API: the four KPI card numbers,
   Total Rooms "N buildings" and Occupancy "X of Y seats" sub-lines,
   and the greeting name (from /me). Everything else new on this
   page is STATIC SAMPLE data from src/lib/staticPreview.ts, clearly
   labelled "Sample" on screen: the 6-month chart, the whole rent
   donut, the recent activity list, and the "N new this month" /
   "N rooms have space" KPI sub-lines. Nothing sample is presented
   as real. When the backend endpoints are built, replace exactly
   that one file (see its header for the field mapping). */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BedDouble,
  DoorClosed,
  FileText,
  Gauge,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { api, ApiError, formatRs, loadSession } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, InfoTooltip, MetricCard, Skeleton } from "@/components/ui";
import { STATIC_PREVIEW, type StaticActivityItem } from "@/lib/staticPreview";

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
  label: string;
  rent_collected: number;
  residents_joined: number;
}

const ACTIVITY_ICON: Record<StaticActivityItem["type"], LucideIcon> = {
  resident_created: UserPlus,
  payment_approved: Wallet,
  application_created: FileText,
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

/** Last 6 calendar month labels, ending with the current month. */
function lastSixMonthLabels(now: Date): string[] {
  const labels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString("en", { month: "short" }));
  }
  return labels;
}

/**
 * Where a recent-activity row links. Resident rows search the
 * residents list by the name in the title ("New resident added:
 * <name>" — the whole prefix is stripped).
 */
function activityHref(item: StaticActivityItem): string {
  if (item.type === "payment_approved") return "/admin/payments?status=approved";
  if (item.type === "application_created") return "/admin/applications";
  const name = item.title
    .replace(/^(new resident added|new resident|resident added|resident)[:\s-]*/i, "")
    .trim();
  return name ? `/admin/residents?search=${encodeURIComponent(name)}` : "/admin/residents";
}

/** Small "Sample" pill marking a card as preview data. */
function SampleBadge() {
  return (
    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-warning">
      Sample
    </span>
  );
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
/* Rent chart — hand-rolled SVG area chart, last 6 months (sample).   */
/* ------------------------------------------------------------------ */

function RentChart({ months }: { months: MonthPoint[] }) {
  const [mode, setMode] = useState<"rent" | "residents">("rent");
  if (months.length === 0) {
    return (
      <p role="status" className="py-10 text-center text-sm text-muted">
        No collections in the last 6 months
      </p>
    );
  }
  const values = months.map((m) => (mode === "rent" ? m.rent_collected : m.residents_joined));
  const max = Math.max(1, ...values);
  const allZero = values.every((v) => v === 0);

  const W = 600;
  const H = 220;
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
  const ariaSummary =
    mode === "rent"
      ? `Rent collected over the last 6 months. Highest ${highest.label}, ${formatRs(highest.rent_collected)}. Lowest ${lowest.label}, ${formatRs(lowest.rent_collected)}.`
      : `New residents over the last 6 months. Highest ${highest.label}, ${highest.residents_joined} joined. Lowest ${lowest.label}, ${lowest.residents_joined} joined.`;

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
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1={padX} y1={padTop} x2={W - padX} y2={padTop} stroke="#E2E8E5" strokeWidth="1" />
          <line
            x1={padX}
            y1={padTop + innerH}
            x2={W - padX}
            y2={padTop + innerH}
            stroke="#E2E8E5"
            strokeWidth="1"
          />
          <text x={padX} y={padTop - 6} fontSize="11" fill="#64748B">
            {fmt(max)}
          </text>
          <path d={area} fill="url(#chartAreaFill)" />
          <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {xs.map((x, i) => (
            <circle key={months[i].label} cx={x} cy={ys[i]} r="4" fill="#FFFFFF" stroke={stroke} strokeWidth="2.5" />
          ))}
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
        {mode === "rent" ? "From approved payments" : "From resident joining dates"} · Sample data
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rent collection donut (whole donut is SAMPLE — see file header).   */
/* Collected (green) vs pending (amber).                              */
/* ------------------------------------------------------------------ */

function RentDonut({ monthParam }: { monthParam: string }) {
  const collected = STATIC_PREVIEW.donut.collected;
  const pending = STATIC_PREVIEW.donut.pending;
  const overdueAmount = STATIC_PREVIEW.donut.overdue;
  const total = collected + pending;

  const R = 70;
  const C = 2 * Math.PI * R;
  const collectedLen = total > 0 ? (collected / total) * C : 0;
  const pendingLen = total > 0 ? (pending / total) * C : 0;

  const legendRow =
    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-ink hover:bg-page";

  return (
    <div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <svg viewBox="0 0 180 180" role="img" aria-label={`Rent collected this month ${formatRs(collected)} of ${formatRs(total)} total due. Sample data.`} className="h-44 w-44 shrink-0">
          <defs>
            <linearGradient id="donutCollected" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2E9E6B" />
              <stop offset="100%" stopColor="#28805A" />
            </linearGradient>
            <linearGradient id="donutPending" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D9A441" />
              <stop offset="100%" stopColor="#B78119" />
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" r={R} fill="none" stroke="#E2E8E5" strokeWidth="22" />
          {total > 0 && pendingLen > 0 ? (
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke="url(#donutPending)"
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
              stroke="url(#donutCollected)"
              strokeWidth="22"
              strokeDasharray={`${collectedLen} ${C - collectedLen}`}
              transform="rotate(-90 90 90)"
            />
          ) : null}
          <text x="90" y="86" textAnchor="middle" fontSize="19" fontWeight="600" fill="#172B25">
            {formatRs(collected)}
          </text>
          <text x="90" y="106" textAnchor="middle" fontSize="12" fill="#64748B">
            Collected
          </text>
        </svg>

        <div className="w-full min-w-0 flex-1 divide-y divide-line">
          <Link href={`/admin/payments?status=approved&month=${monthParam}`} className={legendRow}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-success" aria-hidden />
              Collected
            </span>
            <span className="shrink-0 font-semibold">{formatRs(collected)}</span>
          </Link>
          <div className="flex items-center justify-between gap-2">
            <Link href="/admin/rent?status=due" className={`${legendRow} flex-1`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm bg-warning" aria-hidden />
                Pending
              </span>
              <span className="shrink-0 font-semibold">{formatRs(pending)}</span>
            </Link>
            <InfoTooltip
              text="Pending is the sum of what is still owed on open rent cycles that are due but not fully paid yet."
              label="About pending rent"
            />
          </div>
          <Link
            href="/admin/rent?status=overdue"
            className={`${legendRow} ${overdueAmount > 0 ? "text-danger" : "text-muted"}`}
          >
            <span>
              {overdueAmount > 0
                ? `Overdue ${formatRs(overdueAmount)}`
                : "No overdue rent — all clear"}
            </span>
            <span aria-hidden>→</span>
          </Link>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-2 pt-2.5 text-sm">
            <span className="font-semibold text-ink">Total Due</span>
            <span className="font-semibold text-ink">{formatRs(total)}</span>
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

  useEffect(() => {
    api<DashboardData>("/api/v1/admin/dashboard", { auth: true })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.tryAgain));
    api<{ full_name: string }>("/api/v1/auth/me", { auth: true })
      .then((me) => setAdminName(me.full_name))
      .catch(() => setAdminName(loadSession()?.fullName ?? ""));
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
  // Static chart values, month labels derived from today.
  const chartMonths: MonthPoint[] = lastSixMonthLabels(now).map((label, i) => ({
    label,
    rent_collected: STATIC_PREVIEW.chartMonths[i]?.rentCollected ?? 0,
    residents_joined: STATIC_PREVIEW.chartMonths[i]?.residentsJoined ?? 0,
  }));

  const kpis: {
    icon: LucideIcon;
    label: string;
    value: string | number;
    sub?: string;
    href?: string;
    extra?: ReactNode;
  }[] = data
    ? [
        {
          icon: Users,
          label: t.totalResidents,
          value: data.total_residents,
          sub: `${STATIC_PREVIEW.newResidentsThisMonth} new this month · Sample`,
          href: "/admin/residents",
        },
        {
          icon: BedDouble,
          label: t.vacantSeats,
          value: data.vacant_seats,
          sub:
            STATIC_PREVIEW.roomsWithVacancy === 0
              ? "No rooms have space"
              : `${STATIC_PREVIEW.roomsWithVacancy} room${STATIC_PREVIEW.roomsWithVacancy === 1 ? "" : "s"} have space · Sample`,
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
      <div className="mb-5 rounded-card bg-gradient-to-r from-brand via-[#155C43] to-[#1E6B4F] px-5 py-5 text-white shadow-card sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[30px]">
              {greeting}
              {adminName ? `, ${adminName}` : ""}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/75">
              Here&apos;s a quick overview of Taqwa Boys Hostel.
            </p>
          </div>
          <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
            This month
          </span>
        </div>
      </div>

      <p
        role="note"
        className="mb-5 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink"
      >
        Preview data: the rent chart, rent collection donut, recent activity and the bell counts
        are sample numbers until the backend is ready. Resident, room, seat and occupancy numbers
        are live.
      </p>

      {error ? <ErrorBox message={error} /> : null}

      {!data && !error ? (
        <div role="status" aria-label={t.loading}>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <Card className="mt-3 p-4">
            <Skeleton lines={3} />
          </Card>
        </div>
      ) : null}

      {data ? (
        <>
          <section aria-label="Hostel overview" className="mb-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((m) => (
                <MetricCard
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
                  value={m.value}
                  sub={m.sub}
                  href={m.href}
                  extra={m.extra}
                />
              ))}
            </div>
          </section>

          <section aria-label="Rent chart and collection" className="mb-5 grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">Rent Collected</h2>
                <SampleBadge />
              </div>
              <p className="mb-3 text-sm text-muted">Last 6 months</p>
              <RentChart months={chartMonths} />
            </Card>

            <Card className="lg:col-span-2">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">Rent Collection</h2>
                <SampleBadge />
              </div>
              <p className="mb-3 text-sm text-muted">This month · Sample data</p>
              <RentDonut monthParam={monthParam} />
            </Card>
          </section>

          <section aria-label="Recent activity">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">Recent Activity</h2>
                <SampleBadge />
              </div>
              <ul className="divide-y divide-line">
                {STATIC_PREVIEW.activity.map((item) => {
                  const Icon = ACTIVITY_ICON[item.type] ?? FileText;
                  const at = new Date(Date.now() - item.minutesAgo * 60000).toISOString();
                  return (
                    <li key={item.id}>
                      <Link
                        href={activityHref(item)}
                        className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-active text-brand">
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {item.title}
                          </span>
                          {item.detail ? (
                            <span className="block truncate text-xs text-muted">{item.detail}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs text-muted">{relativeTime(at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
