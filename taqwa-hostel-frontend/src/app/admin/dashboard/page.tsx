"use client";

import { useEffect, useState } from "react";
import { api, ApiError, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, Loading, SectionTitle } from "@/components/ui";

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

  const stats: [string, string | number][] = data
    ? [
        [t.totalResidents, data.total_residents],
        [t.vacantSeats, data.vacant_seats],
        [t.occupiedSeats, data.occupied_seats],
        [t.buildings, data.total_buildings],
        ["Rooms", data.total_rooms],
        [t.paidThisMonth, `${data.paid_this_month} · ${formatRs(data.paid_amount_this_month)}`],
        [t.dueCount, data.due_count],
        [t.overdueCount, data.overdue_count],
      ]
    : [];

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.dashboard} />
      {error ? <ErrorBox message={error} /> : null}
      {!data && !error ? <Loading label={t.loading} /> : null}
      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm font-bold text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-extrabold text-pine-800">{value}</p>
            </Card>
          ))}
        </div>
      ) : null}
      <p className="mt-6 text-sm text-slate-500">
        Paid this month counts rent cycles fully paid in this month. Due and overdue come from open rent cycles.
      </p>
    </AdminShell>
  );
}
