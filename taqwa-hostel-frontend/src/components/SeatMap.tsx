/* Live seat availability from the backend public endpoint.
   Shows real counts per building and room — never sample numbers.
   When the backend has no rooms yet, or the call fails, the state
   is shown honestly instead of inventing seats. */

"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Card, ErrorBox, Loading } from "./ui";

export interface RoomSeats {
  building: string;
  portion: string | null;
  room_number: string;
  room_type: string;
  vacant_seats: number;
  total_seats: number;
}

export default function SeatMap() {
  const { t } = useLang();
  const [rows, setRows] = useState<RoomSeats[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeBuilding, setActiveBuilding] = useState<string>("");

  useEffect(() => {
    let alive = true;
    api<RoomSeats[]>("/api/v1/public/seats/by-room")
      .then((data) => {
        if (!alive) return;
        setRows(data);
        const first = data[0]?.building;
        if (first) setActiveBuilding(first);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const buildings = useMemo(() => [...new Set((rows ?? []).map((r) => r.building))], [rows]);
  const visible = (rows ?? []).filter((r) => r.building === activeBuilding);
  const totalVacant = (rows ?? []).reduce((sum, r) => sum + r.vacant_seats, 0);
  const totalSeats = (rows ?? []).reduce((sum, r) => sum + r.total_seats, 0);

  if (failed) return <ErrorBox message={t.couldNotLoadSeats} />;
  if (rows === null) return <Loading label={t.loading} />;
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-slate-600">{t.noSeatsYet}</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {buildings.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setActiveBuilding(b)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              b === activeBuilding ? "bg-pine-700 text-white" : "border border-slate-300 bg-white text-pine-800"
            }`}
          >
            {b}
          </button>
        ))}
        <span className="ml-auto self-center rounded-full bg-pine-100 px-4 py-2 text-sm font-bold text-pine-800">
          {totalVacant} {t.vacant} / {totalSeats} {t.total}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((room) => (
          <Card key={`${room.building}-${room.room_number}`} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold text-pine-800">Room {room.room_number}</p>
              <p className="text-sm text-slate-500">
                {room.room_type}
                {room.portion ? ` · ${room.portion}` : ""}
              </p>
              <div className="mt-2 flex gap-1" aria-label={`${room.vacant_seats} of ${room.total_seats} seats vacant`}>
                {Array.from({ length: room.total_seats }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-4 w-4 rounded-full ${i < room.vacant_seats ? "bg-green-500" : "bg-slate-300"}`}
                  />
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-pine-700">{room.vacant_seats}</p>
              <p className="text-xs font-semibold text-slate-500">
                {t.vacant} / {room.total_seats} {t.total}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
