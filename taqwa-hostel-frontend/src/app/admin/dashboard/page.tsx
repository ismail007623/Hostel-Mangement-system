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
import { Card, ErrorBox, Loading, MetricCard } from "@/components/ui";

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
    <div className="mb-3">
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

  const occupancy =
    data && data.total_seats > 0 ? Math.round((data.occupied_seats / data.total_seats) * 100) : 0;

  const overview: { icon: LucideIcon; label: string; value: number; tooltip: string }[] = data
    ? [
        {
          icon: Users,
          label: t.totalResidents,
          value: data.total_residents,
          tooltip: "Residents currently living in the hostel.",
        },
        {
          icon: BedDouble,
          label: t.vacantSeats,
          value: data.vacant_seats,
          tooltip: "Seats with no resident assigned.",
        },
        {
          icon: DoorClosed,
          label: "Total rooms",
          value: data.total_rooms,
          tooltip: "All rooms across all buildings.",
        },
        {
          icon: Building2,
          label: t.buildings,
          value: data.total_buildings,
          tooltip: "Buildings in the hostel.",
        },
      ]
    : [];

  const rent: { icon: LucideIcon; label: string; value: string | number; sub: string; tooltip: string }[] =
    data
      ? [
          {
            icon: CheckCircle2,
            label: t.paidThisMonth,
            value: formatRs(data.paid_amount_this_month),
            sub: `${data.paid_this_month} rent cycle${data.paid_this_month === 1 ? "" : "s"} paid`,
            tooltip: "Rent cycles fully paid in this month.",
          },
          {
            icon: Clock,
            label: t.dueCount,
            value: data.due_count,
            sub: "Open rent cycles due now",
            tooltip: "Open rent cycles whose due date has arrived.",
          },
          {
            icon: AlertTriangle,
            label: t.overdueCount,
            value: data.overdue_count,
            sub: "Open rent cycles past due",
            tooltip: "Open rent cycles past their due date.",
          },
        ]
      : [];

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold leading-tight text-ink sm:text-[30px]">
          {t.dashboard}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          How full the hostel is, and where rent stands right now.
        </p>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {!data && !error ? <Loading label={t.loading} /> : null}

      {data ? (
        <>
          <section aria-label="Hostel overview" className="mb-8">
            <SectionHeading title="Hostel overview" sub="People and places in the hostel today." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {overview.map((m) => (
                <MetricCard
                  key={m.label}
                  icon={m.icon}
                  label={m.label}
                  value={m.value}
                  tooltip={m.tooltip}
                />
              ))}
            </div>
          </section>

          <section aria-label="Occupancy overview" className="mb-8">
            <SectionHeading
              title="Occupancy overview"
              sub="Share of seats currently occupied."
            />
            <Card>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-semibold leading-none text-ink">{occupancy}% occupied</p>
                  <p className="mt-1.5 text-sm text-muted">
                    {data.occupied_seats} of {data.total_seats} seats filled
                  </p>
                </div>
                <p className="text-sm font-medium text-muted">
                  {data.vacant_seats} seats available
                </p>
              </div>
              <div
                className="mt-4 h-2 w-full overflow-hidden rounded-lg bg-line"
                role="progressbar"
                aria-valuenow={occupancy}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Occupancy ${occupancy} percent`}
              >
                <div className="h-full rounded-lg bg-brand" style={{ width: `${occupancy}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Total capacity", data.total_seats],
                  ["Occupied seats", data.occupied_seats],
                  ["Available seats", data.vacant_seats],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-active px-2 py-3">
                    <dt className="text-xs font-medium text-muted">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>

          <section aria-label="Rent overview">
            <SectionHeading title="Rent overview" sub="Paid, due and overdue rent cycles." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rent.map((m) => (
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
            <p className="mt-4 text-sm text-muted">
              Paid this month counts rent cycles fully paid in this month. Due and overdue come
              from open rent cycles.
            </p>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
