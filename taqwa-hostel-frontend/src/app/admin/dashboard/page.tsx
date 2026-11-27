"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  DoorClosed,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, InfoTooltip, MetricCard, Skeleton } from "@/components/ui";

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

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2.5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { t } = useLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/v1/admin/dashboard", { auth: true })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.tryAgain));
  }, [t]);

  // Occupancy is undefined when no seats exist at all — the section
  // shows an explicit empty state instead of a misleading "0%".
  const occupancy =
    data && data.total_seats > 0
      ? Math.round((data.occupied_seats / data.total_seats) * 100)
      : null;

  const overview: { icon: LucideIcon; label: string; value: number; tooltip: string; sub?: string }[] = data
    ? [
        {
          icon: Users,
          label: t.totalResidents,
          value: data.total_residents,
          tooltip: "Residents currently living in the hostel.",
          sub: data.total_residents === 0 ? "No residents yet" : undefined,
        },
        {
          icon: BedDouble,
          label: t.vacantSeats,
          value: data.vacant_seats,
          tooltip: "Seats with no resident assigned.",
          sub: data.total_seats === 0 ? "No seats added yet" : undefined,
        },
        {
          icon: DoorClosed,
          label: "Total rooms",
          value: data.total_rooms,
          tooltip: "All rooms across all buildings.",
          sub: data.total_rooms === 0 ? "Add a room to get started" : undefined,
        },
        {
          icon: Building2,
          label: t.buildings,
          value: data.total_buildings,
          tooltip: "Buildings in the hostel.",
          sub: data.total_buildings === 0 ? "Add a building first" : undefined,
        },
      ]
    : [];

  const rent: {
    icon: LucideIcon;
    label: string;
    value: string | number;
    sub: string;
    tooltip: string;
    tone: "success" | "warning" | "danger";
  }[] = data
    ? [
        {
          icon: CheckCircle2,
          label: t.paidThisMonth,
          value: formatRs(data.paid_amount_this_month),
          sub: `${data.paid_this_month} payment${data.paid_this_month === 1 ? "" : "s"} approved this month`,
          tooltip:
            "Money collected this month from approved payments. A cycle paid in two parts counts as two payments.",
          tone: "success",
        },
        {
          icon: Clock,
          label: t.dueCount,
          value: data.due_count,
          sub: "Open cycles due now, incl. partial payments",
          tooltip:
            "Open rent cycles that are due but not fully paid yet. Includes cycles partly paid, and cycles still inside the grace period after the due date.",
          tone: "warning",
        },
        {
          icon: AlertTriangle,
          label: t.overdueCount,
          value: data.overdue_count,
          sub: "Open cycles past due date + grace",
          tooltip:
            "Open rent cycles past their due date plus the grace period. Includes cycles partly paid after the deadline.",
          tone: "danger",
        },
      ]
    : [];

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-[28px] font-semibold leading-tight text-ink sm:text-[30px]">
          {t.dashboard}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          How full the hostel is, and where rent stands right now.
        </p>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {!data && !error ? (
        <div role="status" aria-label={t.loading}>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton lines={3} />
              </Card>
            ))}
          </div>
          <Card className="mb-5 p-4">
            <Skeleton lines={3} />
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton lines={3} />
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <section aria-label="Hostel overview" className="mb-5">
            <SectionHeading title="Hostel overview" sub="People and places in the hostel today." />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {overview.map((m) => (
                <MetricCard
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
                  value={m.value}
                  sub={m.sub}
                  tooltip={m.tooltip}
                />
              ))}
            </div>
          </section>

          <section aria-label="Occupancy overview" className="mb-5">
            <SectionHeading
              title="Occupancy overview"
              sub="Share of seats currently occupied."
            />
            <Card className="p-4 sm:p-5">
              {occupancy === null ? (
                <div className="py-2">
                  <p className="text-base font-semibold text-ink">No seats added yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Add a room to get started — occupancy will show here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-2xl font-semibold leading-none text-ink">
                      {occupancy}% occupied
                      <InfoTooltip
                        text="Occupied seats divided by total seats. A seat counts as occupied only when a resident is assigned to it."
                        label="About occupancy"
                      />
                    </p>
                    <p className="text-sm text-muted">
                      {data.occupied_seats} of {data.total_seats} seats filled
                    </p>
                  </div>
                  <div
                    className="mt-3 h-2 w-full overflow-hidden rounded-lg bg-line"
                    role="progressbar"
                    aria-valuenow={occupancy}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Occupancy ${occupancy} percent`}
                  >
                    <div className="h-full rounded-lg bg-brand" style={{ width: `${occupancy}%` }} />
                  </div>
                  <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                    {[
                      ["Total capacity", data.total_seats],
                      ["Occupied seats", data.occupied_seats],
                      ["Available seats", data.vacant_seats],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted">{label}</dt>
                        <dd className="mt-0.5 text-base font-semibold text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Card>
          </section>

          <section aria-label="Rent overview">
            <SectionHeading title="Rent overview" sub="Paid, due and overdue rent." />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rent.map((m) => (
                <MetricCard
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
                  value={m.value}
                  sub={m.sub}
                  tooltip={m.tooltip}
                  tone={m.tone}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
