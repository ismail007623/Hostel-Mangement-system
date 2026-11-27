/* Live seat availability from the backend public endpoint.
   Shows real counts per building and room — never sample numbers.
   When the backend has no rooms yet, or the call fails, the state
   is shown honestly instead of inventing seats. */

"use client";

import { useEffect, useMemo, useState } from "react";
import { BedSingle } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Card, ErrorBox, Loading, Select } from "./ui";

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
        <p className="text-sm text-muted">{t.noSeatsYet}</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          aria-label="Building"
          className="w-full sm:w-64"
          value={activeBuilding}
          onChange={(e) => setActiveBuilding(e.target.value)}
          options={buildings.map((b) => ({ value: b, label: b }))}
        />
        <span className="rounded-md bg-active px-2.5 py-1 text-xs font-semibold text-brand">
          {totalVacant} {t.vacant} / {totalSeats} {t.total}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((room) => {
          const occupied = room.total_seats - room.vacant_seats;
          return (
            <Card key={`${room.building}-${room.room_number}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold leading-tight text-ink">Room {room.room_number}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {room.room_type}
                    {room.portion ? ` · ${room.portion}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold leading-none text-brand">{room.vacant_seats}</p>
                  <p className="mt-1 text-xs font-medium text-muted">
                    {t.vacant} / {room.total_seats} {t.total}
                  </p>
                </div>
              </div>
              <div
                className="mt-3 flex flex-wrap items-center gap-1.5"
                aria-label={`${room.vacant_seats} of ${room.total_seats} seats vacant`}
              >
                {Array.from({ length: room.total_seats }).map((_, i) => (
                  <span
                    key={i}
                    title={i < room.vacant_seats ? "Vacant seat" : "Occupied seat"}
                    className={`flex h-6 w-6 items-center justify-center rounded-md ${
                      i < room.vacant_seats ? "bg-green-100 text-success" : "bg-brand text-white"
                    }`}
                  >
                    <BedSingle className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ))}
                <span className="ml-1 text-sm font-medium text-muted">
                  {room.vacant_seats} vacant · {occupied} occupied
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-green-100 text-success">
            <BedSingle className="h-3 w-3" aria-hidden />
          </span>
          Available seat
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-brand text-white">
            <BedSingle className="h-3 w-3" aria-hidden />
          </span>
          Occupied seat
        </span>
      </div>
    </div>
  );
}
