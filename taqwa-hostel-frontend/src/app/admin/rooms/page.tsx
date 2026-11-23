/* Admin rooms: buildings -> room cards -> room view modal.
   Building create, room create, room edit and room view are all
   proper modal pop-outs (no inline forms on the page).
   Room create: room number + 2/3/4-seater required, building
   OPTIONAL — blank uses the only building, or auto-creates a
   "Main Building" when there is none. No floor field anywhere. */

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, formatRs, unwrapPage, type Page } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import PersonCard, { type PersonCardData } from "@/components/PersonCard";
import { Card, ErrorBox, Field, Loading, Modal, PrimaryButton, SectionTitle, inputCls } from "@/components/ui";
import type { ExtraCharge } from "@/components/ExtraCharges";

interface Building {
  id: number;
  name: string;
}
interface RoomResident {
  id: number;
  full_name: string;
  phone: string;
  monthly_rent: number;
  extras_total: number;
  monthly_total: number;
}
interface RoomCard {
  id: number;
  building_id: number;
  portion_id: number | null;
  room_number: string;
  room_type: string;
  total_seats: number;
  vacant_seats: number;
  occupied_seats: number;
  residents: RoomResident[];
}
interface Seat {
  id: number;
  room_id: number;
  seat_label: string;
  status: string;
}
interface RoomDetail extends RoomCard {
  seats: Seat[];
  residents: (RoomResident & { extras?: ExtraCharge[] })[];
}

export default function AdminRoomsPage() {
  const { t } = useLang();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<Building | null>(null);
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [roomsPage, setRoomsPage] = useState<Page<RoomCard> | null>(null);
  const [page, setPage] = useState(1);
  const [person, setPerson] = useState<PersonCardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"building" | "room" | "edit" | "view" | null>(null);
  const [newBuilding, setNewBuilding] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("2-seater");
  const [roomBuildingId, setRoomBuildingId] = useState("");
  const [roomPortion, setRoomPortion] = useState("");
  const [portions, setPortions] = useState<{ id: number; name: string }[]>([]);
  const [editing, setEditing] = useState<RoomCard | null>(null);
  const [viewing, setViewing] = useState<RoomDetail | null>(null);

  const loadBuildings = useCallback(async () => {
    try {
      const data = await api<Page<Building>>("/api/v1/admin/buildings?page=1&page_size=100", { auth: true });
      setBuildings(unwrapPage(data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadRooms = useCallback(
    async (building: Building | null, p = 1) => {
      if (!building) {
        setRooms([]);
        setRoomsPage(null);
        return;
      }
      try {
        const data = await api<Page<RoomCard>>(
          `/api/v1/admin/buildings/${building.id}/rooms?page=${p}&page_size=20`,
          { auth: true }
        );
        setRooms(data.items);
        setRoomsPage(data);
        setPage(p);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t.tryAgain);
      }
    },
    [t]
  );

  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  useEffect(() => {
    if (!roomBuildingId) {
      setPortions([]);
      return;
    }
    api<{ id: number; name: string }[]>(`/api/v1/admin/buildings/${roomBuildingId}/portions`, { auth: true })
      .then(setPortions)
      .catch(() => setPortions([]));
  }, [roomBuildingId]);

  function openBuilding(b: Building) {
    setActiveBuilding(b);
    setPerson(null);
    setViewing(null);
    loadRooms(b, 1);
  }

  async function openView(room: RoomCard) {
    try {
      setViewing(await api<RoomDetail>(`/api/v1/admin/rooms/${room.id}`, { auth: true }));
      setModal("view");
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
    try {
      await api("/api/v1/admin/buildings", { method: "POST", auth: true, body: { name: newBuilding.trim() } });
      setNewBuilding("");
      setModal(null);
      setNotice(t.saved);
      loadBuildings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body: Record<string, unknown> = { room_number: roomNumber.trim(), room_type: roomType };
      if (roomBuildingId) body.building_id = Number(roomBuildingId);
      if (roomPortion) body.portion_id = Number(roomPortion);
      const created = await api<RoomCard>("/api/v1/admin/rooms", { method: "POST", auth: true, body });
      setRoomNumber("");
      setRoomPortion("");
      setModal(null);
      setNotice(t.saved);
      await loadBuildings();
      const b = buildings.find((x) => x.id === created.building_id) ?? null;
      if (b) {
        setActiveBuilding(b);
        loadRooms(b, 1);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function editRoom(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await api(`/api/v1/admin/rooms/${editing.id}`, {
        method: "PUT",
        auth: true,
        body: { room_number: roomNumber.trim(), room_type: roomType },
      });
      setModal(null);
      setEditing(null);
      setNotice(t.saved);
      if (activeBuilding) loadRooms(activeBuilding, page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  function startEdit(room: RoomCard) {
    setEditing(room);
    setRoomNumber(room.room_number);
    setRoomType(room.room_type);
    setModal("edit");
  }

  function startCreateRoom() {
    setRoomNumber("");
    setRoomType("2-seater");
    setRoomBuildingId(activeBuilding ? String(activeBuilding.id) : "");
    setRoomPortion("");
    setModal("room");
  }

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.rooms} sub="Rooms are cards: seats, residents and rent at a glance. Use the buttons to add a building or a room." />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={() => setModal("building")}>
          + Add building
        </PrimaryButton>
        <PrimaryButton type="button" onClick={startCreateRoom}>
          + Add room
        </PrimaryButton>
      </div>
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => openBuilding(b)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  activeBuilding?.id === b.id ? "bg-pine-700 text-white" : "border border-slate-300 bg-white text-pine-800"
                }`}
              >
                {b.name}
              </button>
            ))}
            {buildings.length === 0 ? <p className="text-sm text-slate-500">No buildings yet — add one, or add a room and a “Main Building” is created for you.</p> : null}
          </div>

          {activeBuilding ? (
            <>
              <h3 className="mb-3 font-extrabold text-pine-800">
                Rooms — {activeBuilding.name} ({roomsPage?.total ?? rooms.length})
              </h3>
              {rooms.length === 0 ? (
                <Card><p className="text-slate-500">No rooms in this building yet.</p></Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {rooms.map((r) => (
                    <Card key={r.id}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-lg font-extrabold text-pine-800">Room {r.room_number}</h4>
                        <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-pine-800">{r.room_type}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5" aria-label={`${r.vacant_seats} vacant of ${r.total_seats} seats`}>
                        {Array.from({ length: r.total_seats }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-3.5 w-3.5 rounded-full ${i < r.occupied_seats ? "bg-pine-700" : "bg-green-300"}`}
                            title={i < r.occupied_seats ? "Occupied seat" : "Vacant seat"}
                          />
                        ))}
                        <span className="ml-1 text-sm font-semibold text-slate-600">
                          {r.vacant_seats} vacant · {r.occupied_seats} occupied
                        </span>
                      </div>
                      <ul className="mt-3 grid gap-1">
                        {r.residents.map((res) => (
                          <li key={res.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <button type="button" onClick={() => openPerson(res.id)} className="font-bold text-pine-800 hover:underline">
                              {res.full_name}
                            </button>
                            <span className="text-slate-500">{formatRs(res.monthly_total)}/mo</span>
                          </li>
                        ))}
                        {r.residents.length === 0 ? <li className="text-sm text-slate-500">Empty room.</li> : null}
                      </ul>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => openView(r)} className="rounded-full bg-pine-700 px-4 py-2 text-sm font-bold text-white">
                          View
                        </button>
                        <button type="button" onClick={() => startEdit(r)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-pine-800">
                          Edit
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              {roomsPage && roomsPage.pages > 1 ? (
                <div className="mt-4 flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => activeBuilding && loadRooms(activeBuilding, page - 1)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">Page {page} of {roomsPage.pages}</span>
                  <button type="button" disabled={page >= roomsPage.pages} onClick={() => activeBuilding && loadRooms(activeBuilding, page + 1)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">
                    Next
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <Card><p className="text-slate-500">Pick a building to see its rooms.</p></Card>
          )}
          {person ? (
            <div className="mt-4">
              <PersonCard person={person} />
            </div>
          ) : null}
        </>
      )}

      {modal === "building" ? (
        <Modal title="Add building" onClose={() => setModal(null)}>
          <form onSubmit={createBuilding} className="grid gap-4">
            <Field label="Building name">
              <input className={inputCls} required value={newBuilding} onChange={(e) => setNewBuilding(e.target.value)} placeholder="Building 1" />
            </Field>
            <PrimaryButton type="submit">Add building</PrimaryButton>
          </form>
        </Modal>
      ) : null}

      {modal === "room" ? (
        <Modal title="Add room" onClose={() => setModal(null)}>
          <form onSubmit={createRoom} className="grid gap-4">
            <Field label="Room number" hint="Required">
              <input className={inputCls} required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="111" />
            </Field>
            <Field label="Room type" hint="Required — seats are created automatically">
              <select className={inputCls} value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                <option value="2-seater">2-seater</option>
                <option value="3-seater">3-seater</option>
                <option value="4-seater">4-seater</option>
              </select>
            </Field>
            <Field label="Building (optional)" hint="Blank: uses the only building, or creates a “Main Building” when there is none.">
              <select className={inputCls} value={roomBuildingId} onChange={(e) => setRoomBuildingId(e.target.value)}>
                <option value="">— No building picked —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Portion (optional)">
              <select className={inputCls} value={roomPortion} onChange={(e) => setRoomPortion(e.target.value)}>
                <option value="">— No portion —</option>
                {portions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <PrimaryButton type="submit">Add room</PrimaryButton>
          </form>
        </Modal>
      ) : null}

      {modal === "edit" && editing ? (
        <Modal title={`Edit Room ${editing.room_number}`} onClose={() => setModal(null)}>
          <form onSubmit={editRoom} className="grid gap-4">
            <Field label="Room number">
              <input className={inputCls} required value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
            </Field>
            <Field label="Room type">
              <select className={inputCls} value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                <option value="2-seater">2-seater</option>
                <option value="3-seater">3-seater</option>
                <option value="4-seater">4-seater</option>
              </select>
            </Field>
            <p className="text-xs text-slate-500">Shrinking a room only removes vacant seats — a room with a resident in a seat that would go cannot be shrunk.</p>
            <PrimaryButton type="submit">Save changes</PrimaryButton>
          </form>
        </Modal>
      ) : null}

      {modal === "view" && viewing ? (
        <Modal title={`Room ${viewing.room_number} — ${viewing.room_type}`} onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {viewing.seats.map((s) => (
                <span key={s.id} className={`rounded-full px-3 py-1.5 text-sm font-bold ${s.status === "vacant" ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
                  {s.seat_label} · {s.status}
                </span>
              ))}
            </div>
            <ul className="grid gap-2">
              {viewing.residents.map((res) => (
                <li key={res.id} className="rounded-xl bg-cream p-3">
                  <button type="button" onClick={() => openPerson(res.id)} className="font-bold text-pine-800 hover:underline">
                    {res.full_name} · {res.phone}
                  </button>
                  <p className="mt-1 text-sm text-slate-600">
                    Base {formatRs(res.monthly_rent)} · Extras {formatRs(res.extras_total)} · Total {formatRs(res.monthly_total)}/mo
                  </p>
                  {res.extras && res.extras.length > 0 ? (
                    <p className="text-xs text-slate-500">
                      {res.extras.map((e) => `${e.name} ${formatRs(e.monthly_amount)}${e.is_active ? "" : " (off)"}`).join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
              {viewing.residents.length === 0 ? <li className="text-sm text-slate-500">No residents in this room yet.</li> : null}
            </ul>
          </div>
        </Modal>
      ) : null}
    </AdminShell>
  );
}
