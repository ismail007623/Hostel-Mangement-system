/* Resident home: my own profile, my own room, and my current rent
   cycle. Nothing about any other resident is ever fetched here. */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ResidentShell } from "@/components/ResidentShell";
import { Card, ErrorBox, Loading, SectionTitle, StatusPill } from "@/components/ui";

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

  return (
    <ResidentShell>
      <SectionTitle eyebrow={t.resident} title={t.myRoom} />
      {error ? <ErrorBox message={error} /> : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <div className="grid gap-4">
          <Card>
            <h3 className="text-xl font-extrabold text-pine-800">{room?.full_name ?? "—"}</h3>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-cream px-3 py-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Building</dt>
                <dd className="font-semibold text-pine-800">{room?.building_name ?? "—"}</dd>
              </div>
              <div className="rounded-xl bg-cream px-3 py-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Room</dt>
                <dd className="font-semibold text-pine-800">
                  {room?.room_number ? `Room ${room.room_number}` : "—"}
                  {room?.seat_label ? ` · Seat ${room.seat_label}` : ""}
                  {room?.portion_name ? ` · ${room.portion_name}` : ""}
                </dd>
              </div>
              <div className="rounded-xl bg-cream px-3 py-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Monthly rent</dt>
                <dd className="font-semibold text-pine-800">
                  {formatRs(room?.monthly_rent)} base
                  {(room?.extras ?? []).filter((e) => e.is_active).length > 0
                    ? ` + ${(room?.extras ?? []).filter((e) => e.is_active).map((e) => `${e.name} ${formatRs(e.monthly_amount)}`).join(" + ")} = ${formatRs(room?.monthly_total ?? room?.monthly_rent)}`
                    : ""}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">Extra charges apply from the next rent cycle.</dd>
              </div>
              <div className="rounded-xl bg-cream px-3 py-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Start date</dt>
                <dd className="font-semibold text-pine-800">{formatDate(room?.start_date)}</dd>
              </div>
              <div className="rounded-xl bg-cream px-3 py-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Security paid</dt>
                <dd className="font-semibold text-pine-800">{formatRs(room?.security_paid)}</dd>
              </div>
              <div className="rounded-xl bg-cream px-3 py-2">
                <dt className="text-xs font-bold uppercase text-slate-500">Next due date</dt>
                <dd className="font-semibold text-pine-800">{formatDate(room?.next_due_date)}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h3 className="font-extrabold text-pine-800">Current rent</h3>
            {cycle ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-2xl font-extrabold text-pine-700">{formatRs(cycle.remaining)}</span>
                  <span className="text-sm text-slate-500">remaining of {formatRs(cycle.total_amount)}</span>
                  <StatusPill status={cycle.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Due {formatDate(cycle.due_date)} · Final deadline {formatDate(cycle.final_deadline)} · Grace{" "}
                  {cycle.grace_days} days
                </p>
                {cycle.remaining > 0 ? (
                  <Link
                    href="/resident/pay"
                    className="mt-4 inline-block rounded-full bg-pine-700 px-5 py-3 font-bold text-white"
                  >
                    {t.payRent}
                  </Link>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No rent cycle yet. Please ask Qari Sahib.</p>
            )}
          </Card>
        </div>
      )}
    </ResidentShell>
  );
}
