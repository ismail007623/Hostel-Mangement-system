/* Admin residents: list everyone (search + pagination), click for
   the person card, manually add a resident in a modal (fallback for
   anyone who cannot fill the form themselves), export CSV.
   Manual add needs a vacant seat — the picker only lists vacant
   seats. Extra charges (AC / Cooler / Geyser + amount each) are
   optional checkboxes in the add form; default none. */

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, downloadFile, formatDate, formatRs, unwrapPage, type Page } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import PersonCard, { type PersonCardData } from "@/components/PersonCard";
import { ExtrasManager, EXTRA_PRESETS, type ExtraCharge } from "@/components/ExtraCharges";
import { Card, ErrorBox, Field, Loading, Modal, PrimaryButton, SectionTitle, StatusPill, inputCls } from "@/components/ui";

interface ResidentRow {
  id: number;
  full_name: string;
  phone: string;
  cnic_number?: string;
  monthly_rent: number;
  extras_total?: number;
  monthly_total?: number;
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
  const [pageData, setPageData] = useState<Page<ResidentRow> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [person, setPerson] = useState<PersonCardData | null>(null);
  const [personExtras, setPersonExtras] = useState<ExtraCharge[]>([]);
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
  const [extraOn, setExtraOn] = useState<Record<string, boolean>>({});
  const [extraAmount, setExtraAmount] = useState<Record<string, string>>({});
  const [customExtra, setCustomExtra] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const load = useCallback(
    async (p = 1, q = "") => {
      try {
        const qs = new URLSearchParams({ page: String(p), page_size: "20" });
        if (q.trim()) qs.set("search", q.trim());
        const data = await api<Page<ResidentRow>>(`/api/v1/admin/residents?${qs.toString()}`, { auth: true });
        setRows(data.items);
        setPageData(data);
        setPage(p);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t.tryAgain);
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    load(1, "");
  }, [load]);

  useEffect(() => {
    if (showForm) api<Page<Building>>("/api/v1/admin/buildings?page=1&page_size=100", { auth: true }).then((d) => setBuildings(unwrapPage(d))).catch(() => undefined);
  }, [showForm]);

  useEffect(() => {
    if (!buildingId) return;
    api<Page<Room>>(`/api/v1/admin/buildings/${buildingId}/rooms?page=1&page_size=100`, { auth: true }).then((d) => {
      setRooms(unwrapPage(d));
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
      const card = await api<PersonCardData>(`/api/v1/admin/residents/${id}`, { auth: true });
      setPerson(card);
      setPersonExtras(card.extras ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function refreshPerson() {
    if (person) openPerson(person.id);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const extras = EXTRA_PRESETS.filter((p) => extraOn[p] && Number(extraAmount[p]) > 0).map((p) => ({
      name: p,
      monthly_amount: Number(extraAmount[p]),
    }));
    if (customExtra.trim() && Number(customAmount) > 0) {
      extras.push({ name: customExtra.trim(), monthly_amount: Number(customAmount) });
    }
    try {
      await api("/api/v1/admin/residents", {
        method: "POST",
        auth: true,
        body: { ...form, seat_id: Number(seatId), extras },
      });
      setForm(EMPTY_FORM);
      setExtraOn({});
      setExtraAmount({});
      setCustomExtra("");
      setCustomAmount("");
      setShowForm(false);
      setNotice(t.saved);
      load(1, search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function exportCsv() {
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      await downloadFile(`/api/v1/admin/residents/export${qs}`, "taqwa-residents.csv");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  const set = (key: keyof typeof EMPTY_FORM, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.residents} sub="Search by name, phone or CNIC. Monthly total = base rent + active extras." />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            load(1, searchInput);
          }}
        >
          <input
            className={`${inputCls} max-w-sm`}
            placeholder="Search name, phone or CNIC…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <PrimaryButton type="submit">Search</PrimaryButton>
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                load(1, "");
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-pine-800"
            >
              Clear
            </button>
          ) : null}
        </form>
        <button type="button" onClick={exportCsv} className="rounded-full border-2 border-pine-700 bg-white px-5 py-3 text-base font-bold text-pine-700">
          Export CSV
        </button>
        <PrimaryButton type="button" onClick={() => setShowForm(true)}>
          Add resident manually
        </PrimaryButton>
      </div>

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
                    <span className="text-sm text-slate-500">
                      {formatRs(r.monthly_rent)} base{r.monthly_total !== undefined && r.monthly_total !== r.monthly_rent ? ` · ${formatRs(r.monthly_total)} total` : ""}/mo
                    </span>
                    <span className="text-sm text-slate-500">Due {formatDate(r.next_due_date)}</span>
                    <span className="ml-auto">
                      <StatusPill status={r.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pageData && pageData.pages > 1 ? (
            <div className="mt-4 flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => load(page - 1, search)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {pageData.pages} · {pageData.total} residents
              </span>
              <button type="button" disabled={page >= pageData.pages} onClick={() => load(page + 1, search)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">
                Next
              </button>
            </div>
          ) : null}
        </Card>
      )}
      {person ? (
        <div className="mt-4">
          <PersonCard person={{ ...person, extras: personExtras }} />
          <Card className="mt-4">
            <ExtrasManager residentId={person.id} extras={personExtras} onChanged={refreshPerson} />
          </Card>
        </div>
      ) : null}

      {showForm ? (
        <Modal title="Add resident manually" onClose={() => setShowForm(false)}>
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
            <div className="rounded-xl border border-pine-100 p-3 sm:col-span-2">
              <p className="font-bold text-pine-800">Extra charges (optional)</p>
              <p className="mt-1 text-xs text-slate-500">Tick AC, Cooler or Geyser and type the amount. Default: none. They apply from the first rent cycle.</p>
              <div className="mt-2 grid gap-2">
                {EXTRA_PRESETS.map((p) => (
                  <label key={p} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-pine-800">
                    <input
                      type="checkbox"
                      checked={!!extraOn[p]}
                      onChange={(e) => setExtraOn((o) => ({ ...o, [p]: e.target.checked }))}
                    />
                    {p}
                    <input
                      className={`${inputCls} w-32`}
                      type="number"
                      min={1}
                      placeholder="Rs/month"
                      disabled={!extraOn[p]}
                      value={extraAmount[p] ?? ""}
                      onChange={(e) => setExtraAmount((a) => ({ ...a, [p]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-pine-800">
                  Custom:
                  <input className={`${inputCls} w-32`} value={customExtra} onChange={(e) => setCustomExtra(e.target.value)} placeholder="Name" />
                  <input className={`${inputCls} w-32`} type="number" min={1} value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Rs/month" />
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <PrimaryButton type="submit">Add resident</PrimaryButton>
            </div>
          </form>
        </Modal>
      ) : null}
    </AdminShell>
  );
}
