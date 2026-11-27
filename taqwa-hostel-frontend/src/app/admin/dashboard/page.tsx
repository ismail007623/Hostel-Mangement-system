"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Clock,
  DoorClosed,
  Gauge,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, MetricCard, Skeleton } from "@/components/ui";

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

export default function AdminDashboardPage() {
  const { t } = useLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/v1/admin/dashboard", { auth: true })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.tryAgain));
  }, [t]);

  // Occupancy is undefined when no seats exist at all — the card shows
  // an explicit empty state instead of a misleading "0%".
  const occupancy =
    data && data.total_seats > 0
      ? Math.round((data.occupied_seats / data.total_seats) * 100)
      : null;

  const now = new Date();
  const monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const operational: {
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
          sub: data.total_residents === 0 ? "No residents yet" : undefined,
          href: "/admin/residents",
        },
        {
          icon: BedDouble,
          label: t.vacantSeats,
          value: data.vacant_seats,
          sub: data.total_seats === 0 ? "No seats added yet" : undefined,
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

  const rent: {
    icon: LucideIcon;
    label: string;
    value: string | number;
    sub: string;
    tooltip: string;
    tone: "success" | "warning" | "danger" | "default";
    href: string;
  }[] = data
    ? [
        {
          icon: CheckCircle2,
          label: t.paidThisMonth,
          value: formatRs(data.paid_amount_this_month),
          sub: `${data.paid_this_month} payment${data.paid_this_month === 1 ? "" : "s"} approved`,
          tooltip:
            "Money collected this month from approved payments. A cycle paid in two parts counts as two payments.",
          tone: "success",
          href: `/admin/payments?status=approved&month=${monthParam}`,
        },
        {
          icon: Clock,
          label: t.dueCount,
          value: data.due_count,
          sub: "Open cycles, incl. partial payments",
          tooltip:
            "Open rent cycles that are due but not fully paid yet. Includes cycles partly paid, and cycles still inside the grace period after the due date.",
          tone: "warning",
          href: "/admin/rent?status=due",
        },
        {
          icon: AlertTriangle,
          label: t.overdueCount,
          value: data.overdue_count,
          sub:
            data.overdue_count > 0
              ? "Open cycles past due date + grace"
              : "No overdue rent — all clear",
          tooltip:
            "Open rent cycles past their due date plus the grace period. Includes cycles partly paid after the deadline.",
          tone: data.overdue_count > 0 ? "danger" : "default",
          href: "/admin/rent?status=overdue",
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
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton lines={3} />
              </Card>
            ))}
          </div>
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
          <section aria-label="Hostel overview" className="mb-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {operational.map((m) => (
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

          <section aria-label="Rent overview">
            <h2 className="mb-2.5 text-lg font-semibold text-ink">Rent overview</h2>
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
                  href={m.href}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
