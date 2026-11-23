/* Admin residents: list everyone, click for the person card,
   and manually add a resident (fallback for anyone who cannot fill
   the form themselves). Manual add needs a vacant seat — the picker
   only ever lists vacant seats. */

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import PersonCard, { type PersonCardData } from "@/components/PersonCard";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, StatusPill, inputCls } from "@/components/ui";

interface ResidentRow {
  id: number;
  full_name: string;
  phone: string;
  monthly_rent: number;
  security_paid: number;
  start_date: string;
  next_due_date: string;
  status: string;
  seat_id: number | null;
}

interface Building {
  id: number;
  name: string;
}
interface Room {
  id: number;
  room_number: string;
  room_type: string;
}
interface Seat {
  id: number;
  seat_label: string;
  status: string;
}

const EMPTY_FORM = {
  full_name: "",
  father_name: "",
  phone: "",
  guardian_phone: "",
  cnic_number: "",
  password: "",
  start_date: new Date().toISOString().slice(0, 10),
  monthly_rent: 8000,
  security_paid: 0,
};

export default function AdminResidentsPage() {
  const { t } = useLang();
  const [rows, setRows] = useState<ResidentRow[]>([]);
  const [person, setPerson] = useState<PersonCardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatId, setSeatId] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api<ResidentRow[]>("/api/v1/admin/residents", { auth: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showForm) api<Building[]>("/api/v1/admin/buildings", { auth: true }).then(setBuildings).catch(() => undefined);
  }, [showForm]);

  useEffect(() => {
    if (!buildingId) return;
    api<Room[]>(`/api/v1/admin/buildings/${buildingId}/rooms`, { auth: true }).then((r) => {
      setRooms(r);
      setRoomId("");
      setSeats([]);
    });
  }, [buildingId]);

  useEffect(() => {
    if (!roomId) return;
    api<Seat[]>(`/api/v1/admin/rooms/${roomId}/seats`, { auth: true }).then((s) =>
      setSeats(s.filter((x) => x.status === "vacant"))
    );
  }, [roomId]);

  async function openPerson(id: number) {
    try {
      setPerson(await api<PersonCardData>(`/api/v1/admin/residents/${id}`, { auth: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api("/api/v1/admin/residents", {
        method: "POST",
        auth: true,
        body: { ...form, seat_id: Number(seatId) },
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice(t.saved);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  const set = (key: keyof typeof EMPTY_FORM, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.residents} />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      <div className="mb-4">
        <PrimaryButton type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Hide form" : "Add resident manually"}
        </PrimaryButton>
      </div>
      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fullName}>
              <input className={inputCls} required minLength={3} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <Field label={t.fatherName}>
              <input className={inputCls} required minLength={3} value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
            </Field>
            <Field label={t.phone}>
              <input className={inputCls} required pattern="^03\d{9}$" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label={t.guardianPhone}>
              <input className={inputCls} required pattern="^03\d{9}$" value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
            </Field>
            <Field label={t.cnic}>
              <input className={inputCls} required pattern="^\d{5}-\d{7}-\d$" value={form.cnic_number} onChange={(e) => set("cnic_number", e.target.value)} />
            </Field>
            <Field label={t.password}>
              <input className={inputCls} required type="password" minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} />
            </Field>
            <Field label={t.startDate}>
              <input className={inputCls} required type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </Field>
            <Field label={t.monthlyRent}>
              <input className={inputCls} required type="number" min={1} value={form.monthly_rent} onChange={(e) => set("monthly_rent", Number(e.target.value))} />
            </Field>
            <Field label={t.securityPaid}>
              <input className={inputCls} type="number" min={0} value={form.security_paid} onChange={(e) => set("security_paid", Number(e.target.value))} />
            </Field>
            <Field label="Building">
              <select className={inputCls} value={buildingId} onChange={(e) => setBuildingId(e.target.value)} required>
                <option value="">Pick a building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room">
              <select className={inputCls} value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
                <option value="">Pick a room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} · {r.room_type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vacant seat">
              <select className={inputCls} value={seatId} onChange={(e) => setSeatId(e.target.value)} required>
                <option value="">Pick a vacant seat</option>
                {seats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.seat_label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <PrimaryButton type="submit">Add resident</PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <Card>
          {rows.length === 0 ? (
            <p className="text-slate-500">No residents yet. Invite them from the Applications page.</p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openPerson(r.id)}
                    className="flex w-full flex-wrap items-center gap-3 rounded-xl bg-cream px-3 py-2.5 text-left hover:bg-pine-100"
                  >
                    <span className="font-bold text-pine-800">{r.full_name}</span>
                    <span className="text-sm text-slate-500">{r.phone}</span>
                    <span className="text-sm text-slate-500">{formatRs(r.monthly_rent)}/mo</span>
                    <span className="text-sm text-slate-500">Due {formatDate(r.next_due_date)}</span>
                    <span className="ml-auto">
                      <StatusPill status={r.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {person ? (
        <div className="mt-4">
          <PersonCard person={person} />
        </div>
      ) : null}
    </AdminShell>
  );
}
