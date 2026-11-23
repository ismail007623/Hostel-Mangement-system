/* Admin rooms: building -> rooms -> seats -> persons -> person card.
   Also the structure forms: create a building, a portion inside it,
   and a room (seats are auto-created from the 2/3/4-seater type). */

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import PersonCard, { type PersonCardData } from "@/components/PersonCard";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, inputCls } from "@/components/ui";

interface Building {
  id: number;
  name: string;
}
interface Room {
  id: number;
  building_id: number;
  portion_id: number | null;
  room_number: string;
  room_type: string;
}
interface Seat {
  id: number;
  room_id: number;
  seat_label: string;
  status: string;
}
interface RoomResident {
  id: number;
  full_name: string;
  phone: string;
}

export default function AdminRoomsPage() {
  const { t } = useLang();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<Building | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [roomResidents, setRoomResidents] = useState<RoomResident[]>([]);
  const [person, setPerson] = useState<PersonCardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [newBuilding, setNewBuilding] = useState("");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomType, setNewRoomType] = useState("2-seater");

  const loadBuildings = useCallback(async () => {
    try {
      const data = await api<Building[]>("/api/v1/admin/buildings", { auth: true });
      setBuildings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  async function openBuilding(b: Building) {
    setActiveBuilding(b);
    setActiveRoom(null);
    setSeats([]);
    setRoomResidents([]);
    setPerson(null);
    try {
      setRooms(await api<Room[]>(`/api/v1/admin/buildings/${b.id}/rooms`, { auth: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function openRoom(room: Room) {
    setActiveRoom(room);
    setPerson(null);
    try {
      const [s, residents] = await Promise.all([
        api<Seat[]>(`/api/v1/admin/rooms/${room.id}/seats`, { auth: true }),
        api<RoomResident[]>(`/api/v1/admin/rooms/${room.id}/residents`, { auth: true }),
      ]);
      setSeats(s);
      setRoomResidents(residents);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function openPerson(id: number) {
    try {
      setPerson(await api<PersonCardData>(`/api/v1/admin/residents/${id}`, { auth: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function createBuilding(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api("/api/v1/admin/buildings", { method: "POST", auth: true, body: { name: newBuilding.trim() } });
      setNewBuilding("");
      setNotice(t.saved);
      loadBuildings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    if (!activeBuilding) return;
    setError("");
    setNotice("");
    try {
      await api(`/api/v1/admin/buildings/${activeBuilding.id}/rooms`, {
        method: "POST",
        auth: true,
        body: { room_number: newRoomNumber.trim(), room_type: newRoomType },
      });
      setNewRoomNumber("");
      setNotice(t.saved);
      openBuilding(activeBuilding);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.rooms} />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <Card>
              <h3 className="font-extrabold text-pine-800">{t.buildings}</h3>
              <ul className="mt-3 grid gap-2">
                {buildings.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => openBuilding(b)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left font-bold ${
                        activeBuilding?.id === b.id ? "bg-pine-700 text-white" : "bg-cream text-pine-800 hover:bg-pine-100"
                      }`}
                    >
                      {b.name}
                    </button>
                  </li>
                ))}
                {buildings.length === 0 ? <li className="text-sm text-slate-500">No buildings yet.</li> : null}
              </ul>
              <form onSubmit={createBuilding} className="mt-4 flex gap-2">
                <input
                  className={inputCls}
                  placeholder="New building name"
                  value={newBuilding}
                  onChange={(e) => setNewBuilding(e.target.value)}
                  required
                />
                <PrimaryButton type="submit">Add</PrimaryButton>
              </form>
            </Card>
          </div>

          <div>
            <Card>
              <h3 className="font-extrabold text-pine-800">
                {activeBuilding ? `Rooms — ${activeBuilding.name}` : "Rooms"}
              </h3>
              <ul className="mt-3 grid gap-2">
                {rooms.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openRoom(r)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left font-bold ${
                        activeRoom?.id === r.id ? "bg-pine-700 text-white" : "bg-cream text-pine-800 hover:bg-pine-100"
                      }`}
                    >
                      Room {r.room_number} · {r.room_type}
                    </button>
                  </li>
                ))}
                {activeBuilding && rooms.length === 0 ? (
                  <li className="text-sm text-slate-500">No rooms in this building yet.</li>
                ) : null}
              </ul>
              {activeBuilding ? (
                <form onSubmit={createRoom} className="mt-4 grid gap-2">
                  <Field label="Room number">
                    <input className={inputCls} required value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} placeholder="111" />
                  </Field>
                  <Field label="Room type">
                    <select className={inputCls} value={newRoomType} onChange={(e) => setNewRoomType(e.target.value)}>
                      <option value="2-seater">2-seater</option>
                      <option value="3-seater">3-seater</option>
                      <option value="4-seater">4-seater</option>
                    </select>
                  </Field>
                  <PrimaryButton type="submit">Add room</PrimaryButton>
                </form>
              ) : null}
            </Card>
          </div>

          <div>
            <Card>
              <h3 className="font-extrabold text-pine-800">
                {activeRoom ? `Room ${activeRoom.room_number} — seats & residents` : "Seats & residents"}
              </h3>
              {activeRoom ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {seats.map((s) => (
                      <span
                        key={s.id}
                        className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                          s.status === "vacant" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {s.seat_label} · {s.status}
                      </span>
                    ))}
                  </div>
                  <ul className="mt-4 grid gap-2">
                    {roomResidents.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => openPerson(r.id)}
                          className="w-full rounded-xl bg-cream px-3 py-2.5 text-left font-bold text-pine-800 hover:bg-pine-100"
                        >
                          {r.full_name} · {r.phone}
                        </button>
                      </li>
                    ))}
                    {roomResidents.length === 0 ? (
                      <li className="text-sm text-slate-500">No residents in this room yet.</li>
                    ) : null}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Pick a building, then a room.</p>
              )}
            </Card>
            {person ? (
              <div className="mt-4">
                <PersonCard person={person} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
