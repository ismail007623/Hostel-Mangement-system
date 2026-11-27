/* Admin rooms: building selector -> compact room cards -> room view modal.
   Building create, room create, room edit and room view are all
   proper modal pop-outs (no inline forms on the page).
   Room create: room number + 2/3/4-seater required, building
   OPTIONAL — blank uses the only building, or auto-creates a
   "Main Building" when there is none. No floor field anywhere.
   Availability filter is client-side over the loaded page: the
   backend room list endpoints take no availability parameter. */

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BedSingle, Building2, DoorOpen, Eye, MoreVertical, Pencil, Plus } from "lucide-react";
import { api, ApiError, formatRs, unwrapPage, type Page } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import PersonCard, { type PersonCardData } from "@/components/PersonCard";
import {
  Button,
  Card,
  DropdownMenu,
  DropdownMenuItem,
  EmptyState,
  ErrorBox,
  IconButton,
  Input,
  Loading,
  Modal,
  Pagination,
  Select,
  StatusBadge,
  Toolbar,
  useToast,
} from "@/components/ui";
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

type AvailabilityFilter = "all" | "vacant" | "full";

function occupancy(room: RoomCard): { status: string; label: string } {
  if (room.vacant_seats === room.total_seats) return { status: "vacant", label: "Vacant" };
  if (room.vacant_seats === 0) return { status: "occupied", label: "Full" };
  return { status: "active", label: "Partly occupied" };
}

function validAvailability(v: string | null): AvailabilityFilter {
  return v === "vacant" || v === "full" ? v : "all";
}

function AdminRoomsPageContent() {
  const { t } = useLang();
  const toast = useToast();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<Building | null>(null);
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [roomsPage, setRoomsPage] = useState<Page<RoomCard> | null>(null);
  const [page, setPage] = useState(1);
  const [availability, setAvailability] = useState<AvailabilityFilter>(
    validAvailability(searchParams.get("availability"))
  );

  // Keep the URL in sync so a filtered view stays shareable / refreshable.
  function applyAvailability(v: AvailabilityFilter) {
    setAvailability(v);
    router.replace(v === "all" ? pathname : `${pathname}?availability=${v}`);
  }
  const [person, setPerson] = useState<PersonCardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"building" | "room" | "edit" | "view" | null>(null);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newBuilding, setNewBuilding] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("2-seater");
  const [roomBuildingId, setRoomBuildingId] = useState("");
  const [roomPortion, setRoomPortion] = useState("");
  const [portions, setPortions] = useState<{ id: number; name: string }[]>([]);
  const [editing, setEditing] = useState<RoomCard | null>(null);
  const [viewing, setViewing] = useState<RoomDetail | null>(null);

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

  const loadBuildings = useCallback(async (): Promise<Building[]> => {
    try {
      const data = await api<Page<Building>>("/api/v1/admin/buildings?page=1&page_size=100", { auth: true });
      const list = unwrapPage(data);
      setBuildings(list);
      // Auto-select when there is only one building.
      if (list.length === 1) {
        setActiveBuilding(list[0]);
        loadRooms(list[0], 1);
      }
      return list;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
      return [];
    } finally {
      setLoading(false);
    }
  }, [t, loadRooms]);

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

  const filteredRooms = useMemo(() => {
    if (availability === "vacant") return rooms.filter((r) => r.vacant_seats > 0);
    if (availability === "full") return rooms.filter((r) => r.vacant_seats === 0);
    return rooms;
  }, [rooms, availability]);

  function openBuilding(b: Building | null) {
    setActiveBuilding(b);
    setPerson(null);
    setViewing(null);
    applyAvailability("all");
    loadRooms(b, 1);
  }

  async function openView(room: RoomCard) {
    try {
      setViewing(await api<RoomDetail>(`/api/v1/admin/rooms/${room.id}`, { auth: true }));
      setModalError("");
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

  function closeModal() {
    setModal(null);
    setModalError("");
    setSaving(false);
  }

  async function createBuilding(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    setSaving(true);
    try {
      await api("/api/v1/admin/buildings", { method: "POST", auth: true, body: { name: newBuilding.trim() } });
      setNewBuilding("");
      closeModal();
      toast.success(t.saved);
      loadBuildings();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setSaving(false);
    }
  }

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    setModalError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = { room_number: roomNumber.trim(), room_type: roomType };
      if (roomBuildingId) body.building_id = Number(roomBuildingId);
      if (roomPortion) body.portion_id = Number(roomPortion);
      const created = await api<RoomCard>("/api/v1/admin/rooms", { method: "POST", auth: true, body });
      setRoomNumber("");
      setRoomPortion("");
      closeModal();
      toast.success(t.saved);
      const list = await loadBuildings();
      const b = list.find((x) => x.id === created.building_id) ?? null;
      if (b) {
        setActiveBuilding(b);
        loadRooms(b, 1);
      }
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setSaving(false);
    }
  }

  async function editRoom(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setModalError("");
    setSaving(true);
    try {
      await api(`/api/v1/admin/rooms/${editing.id}`, {
        method: "PUT",
        auth: true,
        body: { room_number: roomNumber.trim(), room_type: roomType },
      });
      closeModal();
      setEditing(null);
      toast.success(t.saved);
      if (activeBuilding) loadRooms(activeBuilding, page);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(room: RoomCard) {
    setEditing(room);
    setRoomNumber(room.room_number);
    setRoomType(room.room_type);
    setModalError("");
    setModal("edit");
  }

  function startCreateRoom() {
    setRoomNumber("");
    setRoomType("2-seater");
    // Pre-select the active building — or the only building, when there is one.
    setRoomBuildingId(
      activeBuilding ? String(activeBuilding.id) : buildings.length === 1 ? String(buildings[0].id) : ""
    );
    setRoomPortion("");
    setModalError("");
    setModal("room");
  }

  function onCardKeyDown(e: KeyboardEvent, room: RoomCard) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openView(room);
    }
  }

  const totalVacant = rooms.reduce((s, r) => s + r.vacant_seats, 0);

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink sm:text-[30px]">{t.rooms}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Rooms are cards: seats, residents and rent at a glance. Pick a building, then add a room or a building.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Building2} onClick={() => { setNewBuilding(""); setModalError(""); setModal("building"); }}>
            Add building
          </Button>
          <Button icon={Plus} onClick={startCreateRoom}>
            Add room
          </Button>
        </div>
      </div>

      {error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}

      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <>
          <Toolbar className="mb-4">
            <Select
              aria-label="Building"
              className="w-full sm:w-64"
              value={activeBuilding ? String(activeBuilding.id) : ""}
              onChange={(e) => {
                const b = buildings.find((x) => x.id === Number(e.target.value)) ?? null;
                openBuilding(b);
              }}
              options={[
                { value: "", label: "All buildings — pick one" },
                ...buildings.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
            />
            <Select
              aria-label="Availability"
              className="w-full sm:w-56"
              value={availability}
              onChange={(e) => applyAvailability(e.target.value as AvailabilityFilter)}
              options={[
                { value: "all", label: "All rooms" },
                { value: "vacant", label: "Has vacant seats" },
                { value: "full", label: "Fully occupied" },
              ]}
            />
            {activeBuilding ? (
              <span className="ml-auto text-sm text-muted">
                {roomsPage?.total ?? rooms.length} rooms · {totalVacant} vacant seats
              </span>
            ) : null}
          </Toolbar>

          {buildings.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No buildings yet"
              description="Add a building, or add a room and a “Main Building” is created for you."
              action={<Button icon={Plus} onClick={startCreateRoom}>Add room</Button>}
            />
          ) : !activeBuilding ? (
            <Card>
              <p className="text-sm text-muted">Pick a building above to see its rooms.</p>
            </Card>
          ) : rooms.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No rooms in this building yet"
              description={`Add the first room to ${activeBuilding.name}.`}
              action={<Button icon={Plus} onClick={startCreateRoom}>Add room</Button>}
            />
          ) : filteredRooms.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No rooms match this filter"
              description="Try a different availability filter to see more rooms."
              action={<Button variant="secondary" onClick={() => applyAvailability("all")}>Show all rooms</Button>}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredRooms.map((r) => {
                  const occ = occupancy(r);
                  return (
                    <Card
                      key={r.id}
                      className="cursor-pointer transition-colors hover:border-brand/40"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`View Room ${r.room_number}`}
                        onClick={() => openView(r)}
                        onKeyDown={(e) => onCardKeyDown(e, r)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-active text-brand">
                              <DoorOpen className="h-5 w-5" aria-hidden />
                            </span>
                            <span>
                              <span className="block text-lg font-semibold leading-tight text-ink">
                                Room {r.room_number}
                              </span>
                              <span className="block text-xs text-muted">{r.room_type}</span>
                            </span>
                          </span>
                          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            <DropdownMenu
                              label={`Actions for Room ${r.room_number}`}
                              trigger={<IconButton label={`Actions for Room ${r.room_number}`} icon={MoreVertical} />}
                            >
                              <DropdownMenuItem icon={Eye} onSelect={() => openView(r)}>
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem icon={Pencil} onSelect={() => startEdit(r)}>
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenu>
                          </span>
                        </div>

                        <div
                          className="mt-3 flex flex-wrap items-center gap-1.5"
                          aria-label={`${r.vacant_seats} vacant of ${r.total_seats} seats`}
                        >
                          {Array.from({ length: r.total_seats }).map((_, i) => (
                            <span
                              key={i}
                              title={i < r.occupied_seats ? "Occupied seat" : "Vacant seat"}
                              className={`flex h-6 w-6 items-center justify-center rounded-md ${
                                i < r.occupied_seats ? "bg-brand text-white" : "bg-green-100 text-success"
                              }`}
                            >
                              <BedSingle className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          ))}
                          <span className="ml-1 text-sm font-medium text-muted">
                            {r.vacant_seats} vacant · {r.occupied_seats} occupied
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <StatusBadge status={occ.status} label={occ.label} />
                          <span className="text-xs text-muted">
                            {r.total_seats} seats
                          </span>
                        </div>

                        <ul className="mt-3 grid gap-1 border-t border-line pt-3">
                          {r.residents.map((res) => (
                            <li key={res.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPerson(res.id);
                                }}
                                className="font-semibold text-brand hover:underline"
                              >
                                {res.full_name}
                              </button>
                              <span className="text-muted">{formatRs(res.monthly_total)}/mo</span>
                            </li>
                          ))}
                          {r.residents.length === 0 ? (
                            <li className="text-sm text-muted">Empty room.</li>
                          ) : null}
                        </ul>
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

              {roomsPage && roomsPage.pages > 1 ? (
                <div className="mt-4">
                  <Pagination
                    page={page}
                    pages={roomsPage.pages}
                    total={roomsPage.total}
                    onPage={(p) => activeBuilding && loadRooms(activeBuilding, p)}
                  />
                </div>
              ) : null}
            </>
          )}
          {person ? (
            <div className="mt-4">
              <PersonCard person={person} />
            </div>
          ) : null}
        </>
      )}

      {modal === "building" ? (
        <Modal title="Add building" onClose={closeModal}>
          <form onSubmit={createBuilding} className="grid gap-4">
            {modalError ? <ErrorBox message={modalError} /> : null}
            <Input
              label="Building name"
              required
              value={newBuilding}
              onChange={(e) => setNewBuilding(e.target.value)}
              placeholder="Building 1"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Add building
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modal === "room" ? (
        <Modal title="Add room" onClose={closeModal}>
          <form onSubmit={createRoom} className="grid gap-4">
            {modalError ? <ErrorBox message={modalError} /> : null}
            <Input
              label="Room number"
              required
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="111"
              helperText="Required"
            />
            <Select
              label="Room type"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              helperText="Required — seats are created automatically"
              options={[
                { value: "2-seater", label: "2-seater" },
                { value: "3-seater", label: "3-seater" },
                { value: "4-seater", label: "4-seater" },
              ]}
            />
            <Select
              label="Building (optional)"
              value={roomBuildingId}
              onChange={(e) => setRoomBuildingId(e.target.value)}
              helperText="Blank: uses the only building, or creates a “Main Building” when there is none."
              options={[
                { value: "", label: "— No building picked —" },
                ...buildings.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
            />
            <Select
              label="Portion (optional)"
              value={roomPortion}
              onChange={(e) => setRoomPortion(e.target.value)}
              options={[
                { value: "", label: "— No portion —" },
                ...portions.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Add room
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modal === "edit" && editing ? (
        <Modal title={`Edit Room ${editing.room_number}`} onClose={closeModal}>
          <form onSubmit={editRoom} className="grid gap-4">
            {modalError ? <ErrorBox message={modalError} /> : null}
            <Input
              label="Room number"
              required
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
            />
            <Select
              label="Room type"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              options={[
                { value: "2-seater", label: "2-seater" },
                { value: "3-seater", label: "3-seater" },
                { value: "4-seater", label: "4-seater" },
              ]}
            />
            <p className="text-xs text-muted">
              Shrinking a room only removes vacant seats — a room with a resident in a seat that would go cannot be
              shrunk.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modal === "view" && viewing ? (
        <Modal title={`Room ${viewing.room_number} — ${viewing.room_type}`} onClose={closeModal} size="lg">
          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Seats</p>
              <div className="flex flex-wrap gap-2">
                {viewing.seats.map((s) => (
                  <span
                    key={s.id}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      s.status === "vacant" ? "bg-active text-brand" : "bg-slate-100 text-muted"
                    }`}
                  >
                    {s.seat_label} · {s.status}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Residents</p>
              <ul className="grid gap-2">
                {viewing.residents.map((res) => (
                  <li key={res.id} className="rounded-card border border-line bg-page p-3">
                    <button
                      type="button"
                      onClick={() => openPerson(res.id)}
                      className="font-semibold text-brand hover:underline"
                    >
                      {res.full_name} · {res.phone}
                    </button>
                    <p className="mt-1 text-sm text-muted">
                      Base {formatRs(res.monthly_rent)} · Extras {formatRs(res.extras_total)} · Total{" "}
                      {formatRs(res.monthly_total)}/mo
                    </p>
                    {res.extras && res.extras.length > 0 ? (
                      <p className="text-xs text-muted">
                        {res.extras.map((e) => `${e.name} ${formatRs(e.monthly_amount)}${e.is_active ? "" : " (off)"}`).join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))}
                {viewing.residents.length === 0 ? (
                  <li className="text-sm text-muted">No residents in this room yet.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </Modal>
      ) : null}
    </AdminShell>
  );
}

/* useSearchParams needs a Suspense boundary (Next.js App Router). */
export default function AdminRoomsPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <AdminRoomsPageContent />
    </Suspense>
  );
}
