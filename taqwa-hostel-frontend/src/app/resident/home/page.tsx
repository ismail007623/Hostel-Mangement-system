/* Resident home: my own profile, my own room, and my current rent
   cycle. Nothing about any other resident is ever fetched here. */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BedDouble, Wallet } from "lucide-react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import { Card, ErrorBox, Loading, MetricCard, SectionTitle, StatusPill } from "@/components/ui";

interface MyRoom {
  full_name: string;
  building_name: string | null;
  portion_name: string | null;
  room_number: string | null;
  seat_label: string | null;
  monthly_rent: number;
  extras?: { name: string; monthly_amount: number; is_active: boolean }[];
  extras_total?: number;
  monthly_total?: number;
  start_date: string;
  next_due_date: string;
  security_paid: number;
}

interface Cycle {
  id: number;
  start_date: string;
  due_date: string;
  final_deadline: string;
  grace_days: number;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  status: string;
}

export default function ResidentHomePage() {
  const { t } = useLang();
  const [room, setRoom] = useState<MyRoom | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<MyRoom>("/api/v1/resident/my-room", { auth: true }).catch(() => null),
      api<Cycle>("/api/v1/resident/rent/current", { auth: true }).catch(() => null),
    ])
      .then(([r, c]) => {
        setRoom(r);
        setCycle(c);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t.tryAgain))
      .finally(() => setLoading(false));
  }, [t]);

  const activeExtras = (room?.extras ?? []).filter((e) => e.is_active);

  return (
    <ResidentShell>
      <SectionTitle eyebrow={t.resident} title={t.myRoom} sub="Your room, your rent, and your current cycle." />
      {error ? <ErrorBox message={error} /> : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              icon={Wallet}
              label="Remaining this cycle"
              value={cycle ? formatRs(cycle.remaining) : "—"}
              sub={cycle ? `of ${formatRs(cycle.total_amount)} · due ${formatDate(cycle.due_date)}` : undefined}
            />
            <MetricCard
              icon={BedDouble}
              label="Monthly total"
              value={formatRs(room?.monthly_total ?? room?.monthly_rent)}
              sub={
                activeExtras.length > 0
                  ? `${formatRs(room?.monthly_rent)} base + ${activeExtras
                      .map((e) => `${e.name} ${formatRs(e.monthly_amount)}`)
                      .join(" + ")}`
                  : "Base rent only"
              }
              tooltip="Extra charges apply from the next rent cycle."
            />
          </div>
          <Card>
            <h2 className="text-lg font-semibold text-ink">{room?.full_name ?? "—"}</h2>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-card bg-page px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Building</dt>
                <dd className="font-semibold text-ink">{room?.building_name ?? "—"}</dd>
              </div>
              <div className="rounded-card bg-page px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Room</dt>
                <dd className="font-semibold text-ink">
                  {room?.room_number ? `Room ${room.room_number}` : "—"}
                  {room?.seat_label ? ` · Seat ${room.seat_label}` : ""}
                  {room?.portion_name ? ` · ${room.portion_name}` : ""}
                </dd>
              </div>
              <div className="rounded-card bg-page px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Start date</dt>
                <dd className="font-semibold text-ink">{formatDate(room?.start_date)}</dd>
              </div>
              <div className="rounded-card bg-page px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Security paid</dt>
                <dd className="font-semibold text-ink">{formatRs(room?.security_paid)}</dd>
              </div>
              <div className="rounded-card bg-page px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Next due date</dt>
                <dd className="font-semibold text-ink">{formatDate(room?.next_due_date)}</dd>
              </div>
              <div className="rounded-card bg-page px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Current cycle</dt>
                <dd className="font-semibold text-ink">
                  {cycle ? (
                    <span className="flex flex-wrap items-center gap-2">
                      Due {formatDate(cycle.due_date)}
                      <StatusPill status={cycle.status} />
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-ink">Current rent</h2>
            {cycle ? (
              <>
                <p className="mt-2 text-sm text-muted">
                  Due {formatDate(cycle.due_date)} · Final deadline {formatDate(cycle.final_deadline)} · Grace{" "}
                  {cycle.grace_days} days · Paid {formatRs(cycle.paid_amount)} of {formatRs(cycle.total_amount)}
                </p>
                {cycle.remaining > 0 ? (
                  <Link
                    href="/resident/pay"
                    className="mt-4 inline-flex h-11 items-center justify-center rounded-btn bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    {t.payRent}
                  </Link>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">No rent cycle yet. Please ask Qari Sahib.</p>
            )}
          </Card>
        </div>
      )}
    </ResidentShell>
  );
}
