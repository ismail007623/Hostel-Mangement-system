/* Admin residents: searchable, filterable data table, click for the
   person card, manually add a resident in a 3-step wizard (fallback
   for anyone who cannot fill the form themselves), export CSV.
   Manual add needs a vacant seat — the picker only lists vacant
   seats. Extra charges (AC / Cooler / Geyser + amount each) are
   optional in step 3; default none.
   NOTE: the list API only supports ?search= (name/phone/CNIC) and
   returns seat_id only — no building/room/status params and no
   building/room names. Building, room and status filters below are
   therefore applied client-side to the loaded page, and building /
   room / seat names are resolved from the real buildings/rooms/seats
   endpoints (seat_id -> room -> building). */

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Download,
  Eye,
  EyeOff,
  MessageCircle,
  MoreHorizontal,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  downloadFile,
  formatDate,
  formatRs,
  unwrapPage,
  waLink,
  type Page,
} from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import PersonCard, { type PersonCardData } from "@/components/PersonCard";
import { ExtrasManager, EXTRA_PRESETS, type ExtraCharge } from "@/components/ExtraCharges";
import {
  Button,
  Card,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuItem,
  EmptyState,
  ErrorBox,
  Field,
  IconButton,
  Input,
  Loading,
  Modal,
  Pagination,
  SearchInput,
  Select,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
  Toolbar,
  inputCls,
  useToast,
} from "@/components/ui";

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
interface RoomEx extends Room {
  buildingId: number;
  buildingName: string;
}
interface Seat {
  id: number;
  seat_label: string;
  status: string;
}
interface SeatLocation {
  building: string;
  room: string;
  seat: string;
  buildingId: number;
  roomId: number;
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

const PHONE_RE = /^03\d{9}$/;
const CNIC_RE = /^\d{5}-\d{7}-\d$/;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Add Resident wizard — 3 steps inside the shared Modal               */
/* ------------------------------------------------------------------ */

const WIZARD_STEPS = ["Personal information", "Accommodation", "Rent & charges"];

function AddResidentWizard({
  buildings,
  allRooms,
  seatsByRoom,
  onClose,
  onAdded,
}: {
  buildings: Building[];
  allRooms: RoomEx[];
  seatsByRoom: Record<number, Seat[]>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useLang();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [buildingId, setBuildingId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [seatId, setSeatId] = useState("");
  const [extraOn, setExtraOn] = useState<Record<string, boolean>>({});
  const [extraAmount, setExtraAmount] = useState<Record<string, string>>({});
  const [customExtra, setCustomExtra] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [wizardError, setWizardError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);

  const roomsForBuilding = useMemo(
    () => (buildingId ? allRooms.filter((r) => r.buildingId === Number(buildingId)) : []),
    [allRooms, buildingId]
  );
  const vacantSeats = useMemo(
    () => (roomId ? (seatsByRoom[Number(roomId)] ?? []).filter((s) => s.status === "vacant") : []),
    [seatsByRoom, roomId]
  );

  const extrasSum = useMemo(() => {
    let sum = EXTRA_PRESETS.filter((p) => extraOn[p]).reduce(
      (s, p) => s + (Number(extraAmount[p]) || 0),
      0
    );
    if (customExtra.trim()) sum += Number(customAmount) || 0;
    return sum;
  }, [extraOn, extraAmount, customExtra, customAmount]);
  const monthlyTotal = (Number(form.monthly_rent) || 0) + extrasSum;

  const isDirty = useMemo(
    () =>
      form.full_name !== "" ||
      form.father_name !== "" ||
      form.phone !== "" ||
      form.guardian_phone !== "" ||
      form.cnic_number !== "" ||
      form.password !== "" ||
      form.monthly_rent !== EMPTY_FORM.monthly_rent ||
      form.security_paid !== 0 ||
      buildingId !== "" ||
      roomId !== "" ||
      seatId !== "" ||
      Object.values(extraOn).some(Boolean) ||
      customExtra !== "" ||
      customAmount !== "",
    [form, buildingId, roomId, seatId, extraOn, customExtra, customAmount]
  );

  // Focus the first field of each step when the step changes.
  useEffect(() => {
    stepRef.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, [step]);

  const set = (key: keyof typeof EMPTY_FORM, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  function validate(current: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (current === 1) {
      if (form.full_name.trim().length < 3) e.full_name = "Enter the full name (at least 3 letters).";
      if (form.father_name.trim().length < 3) e.father_name = "Enter the father name (at least 3 letters).";
      if (!PHONE_RE.test(form.phone.trim())) e.phone = "Phone must be 03XXXXXXXXX (11 digits).";
      if (!PHONE_RE.test(form.guardian_phone.trim())) e.guardian_phone = "Guardian phone must be 03XXXXXXXXX (11 digits).";
      if (!CNIC_RE.test(form.cnic_number.trim())) e.cnic_number = "CNIC must be 12345-1234567-1.";
      if (form.password.length < 6) e.password = "Password must be at least 6 characters.";
    }
    if (current === 2) {
      if (!buildingId) e.building = "Pick a building.";
      if (!roomId) e.room = "Pick a room.";
      if (!seatId) e.seat = "Pick a vacant seat.";
      if (!form.start_date) e.start_date = "Pick a joining date.";
    }
    if (current === 3) {
      if (!(Number(form.monthly_rent) > 0)) e.monthly_rent = "Monthly rent must be more than Rs 0.";
      if (Number(form.security_paid) < 0) e.security_paid = "Security paid cannot be negative.";
      for (const p of EXTRA_PRESETS) {
        if (extraOn[p] && !(Number(extraAmount[p]) > 0)) e[`extra_${p}`] = "Enter an amount above Rs 0.";
      }
      if (customExtra.trim() && !(Number(customAmount) > 0)) e.custom_amount = "Enter an amount above Rs 0.";
      if (!customExtra.trim() && Number(customAmount) > 0) e.custom_name = "Name the custom charge.";
    }
    return e;
  }

  function requestClose() {
    if (submitting) return;
    if (isDirty) setShowConfirm(true);
    else onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const errs = validate(step);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    // Step 3: register the resident with the existing manual-add API.
    const extras = EXTRA_PRESETS.filter((p) => extraOn[p] && Number(extraAmount[p]) > 0).map((p) => ({
      name: p,
      monthly_amount: Number(extraAmount[p]),
    }));
    if (customExtra.trim() && Number(customAmount) > 0) {
      extras.push({ name: customExtra.trim(), monthly_amount: Number(customAmount) });
    }
    setSubmitting(true);
    setWizardError("");
    try {
      await api("/api/v1/admin/residents", {
        method: "POST",
        auth: true,
        body: { ...form, seat_id: Number(seatId), extras },
      });
      toast.success(t.saved);
      onAdded();
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.tryAgain;
      setWizardError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        title="Add resident"
        size="lg"
        onClose={requestClose}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={requestClose} disabled={submitting}>
              Cancel
            </Button>
            {step > 1 ? (
              <Button variant="secondary" type="button" onClick={() => setStep(step - 1)} disabled={submitting}>
                Back
              </Button>
            ) : null}
            <Button
              variant="primary"
              type="submit"
              form="add-resident-form"
              loading={submitting}
            >
              {step < 3 ? "Continue" : "Register resident"}
            </Button>
          </>
        }
      >
        {/* Step progress */}
        <ol className="mb-5 flex items-start" aria-label="Registration progress">
          {WIZARD_STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label} className="flex flex-1 items-start" aria-current={current ? "step" : undefined}>
                {i > 0 ? <span className={`mt-4 h-px flex-1 ${done ? "bg-brand" : "bg-line"}`} aria-hidden /> : null}
                <span className="flex flex-col items-center gap-1.5 px-1 text-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                      current
                        ? "bg-brand text-white"
                        : done
                          ? "bg-active text-brand"
                          : "border border-line bg-white text-muted"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden /> : n}
                  </span>
                  <span className={`text-xs font-medium ${current ? "text-ink" : "text-muted"}`}>{label}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {wizardError ? <ErrorBox message={wizardError} /> : null}

        <form id="add-resident-form" autoComplete="off" onSubmit={submit} noValidate>
          <div ref={stepRef}>
            {step === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full name *"
                  required
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  error={errors.full_name}
                  placeholder="e.g. Muhammad Ali"
                />
                <Input
                  label="Father name *"
                  required
                  value={form.father_name}
                  onChange={(e) => set("father_name", e.target.value)}
                  error={errors.father_name}
                />
                <Input
                  label="Phone *"
                  required
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  error={errors.phone}
                  helperText="03XXXXXXXXX — this is the resident's login."
                  placeholder="03XXXXXXXXX"
                />
                <Input
                  label="Guardian phone *"
                  required
                  inputMode="tel"
                  value={form.guardian_phone}
                  onChange={(e) => set("guardian_phone", e.target.value)}
                  error={errors.guardian_phone}
                  placeholder="03XXXXXXXXX"
                />
                <Input
                  label="CNIC *"
                  required
                  autoComplete="off"
                  inputMode="numeric"
                  value={form.cnic_number}
                  onChange={(e) => set("cnic_number", e.target.value)}
                  error={errors.cnic_number}
                  helperText="Format: 12345-1234567-1"
                  placeholder="12345-1234567-1"
                />
                <Field label="Password *" error={errors.password} hint="At least 6 characters. The resident uses this to log in.">
                  <span className="relative block">
                    <input
                      className={`${inputCls} pr-11`}
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      aria-invalid={errors.password ? true : undefined}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-page hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </span>
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Building *"
                  required
                  value={buildingId}
                  onChange={(e) => {
                    setBuildingId(e.target.value);
                    setRoomId("");
                    setSeatId("");
                  }}
                  error={errors.building}
                  options={[
                    { value: "", label: "Pick a building" },
                    ...buildings.map((b) => ({ value: String(b.id), label: b.name })),
                  ]}
                />
                <Select
                  label="Room *"
                  required
                  value={roomId}
                  disabled={!buildingId}
                  onChange={(e) => {
                    setRoomId(e.target.value);
                    setSeatId("");
                  }}
                  error={errors.room}
                  options={[
                    { value: "", label: buildingId ? "Pick a room" : "Pick a building first" },
                    ...roomsForBuilding.map((r) => ({
                      value: String(r.id),
                      label: `Room ${r.room_number} · ${r.room_type}`,
                    })),
                  ]}
                />
                <Select
                  label="Vacant seat *"
                  required
                  value={seatId}
                  disabled={!roomId}
                  onChange={(e) => setSeatId(e.target.value)}
                  error={errors.seat}
                  options={[
                    {
                      value: "",
                      label: roomId
                        ? vacantSeats.length
                          ? "Pick a vacant seat"
                          : "No vacant seats in this room"
                        : "Pick a room first",
                    },
                    ...vacantSeats.map((s) => ({ value: String(s.id), label: s.seat_label })),
                  ]}
                />
                <Input
                  label="Joining date *"
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                  error={errors.start_date}
                  helperText="Rent is due 30 days after this date, then every 30 days."
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Monthly rent (Rs) *"
                    required
                    type="number"
                    min={1}
                    value={form.monthly_rent}
                    onChange={(e) => set("monthly_rent", Number(e.target.value))}
                    error={errors.monthly_rent}
                  />
                  <Input
                    label="Security deposit paid (Rs)"
                    type="number"
                    min={0}
                    value={form.security_paid}
                    onChange={(e) => set("security_paid", Number(e.target.value))}
                    error={errors.security_paid}
                    helperText="One-time deposit, kept separate from monthly rent."
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-ink">Additional charges <span className="font-normal text-muted">(optional)</span></p>
                  <p className="mb-2 text-xs text-muted">
                    Tick a charge and type the amount. They apply from the first rent cycle.
                  </p>
                  <div className="grid gap-2">
                    {EXTRA_PRESETS.map((p) => (
                      <div key={p} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
                          <input
                            type="checkbox"
                            checked={!!extraOn[p]}
                            onChange={(e) => setExtraOn((o) => ({ ...o, [p]: e.target.checked }))}
                            className="h-4 w-4 accent-[#103D30]"
                          />
                          {p}
                        </label>
                        <input
                          className={`${inputCls} w-36`}
                          type="number"
                          min={1}
                          placeholder="Rs/month"
                          disabled={!extraOn[p]}
                          value={extraAmount[p] ?? ""}
                          onChange={(e) => setExtraAmount((a) => ({ ...a, [p]: e.target.value }))}
                          aria-label={`${p} amount per month`}
                        />
                        {errors[`extra_${p}`] ? (
                          <span className="text-xs font-medium text-danger">{errors[`extra_${p}`]}</span>
                        ) : null}
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                      <input
                        className={`${inputCls} w-36`}
                        value={customExtra}
                        onChange={(e) => setCustomExtra(e.target.value)}
                        placeholder="Custom charge name"
                        aria-label="Custom charge name"
                      />
                      <input
                        className={`${inputCls} w-36`}
                        type="number"
                        min={1}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Rs/month"
                        aria-label="Custom charge amount per month"
                      />
                      {errors.custom_name || errors.custom_amount ? (
                        <span className="text-xs font-medium text-danger">
                          {errors.custom_name ?? errors.custom_amount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <Card className="bg-page p-4 sm:p-4">
                  <h4 className="text-sm font-semibold text-ink">Monthly summary</h4>
                  <dl className="mt-2 grid gap-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">Base rent</dt>
                      <dd className="font-semibold text-ink">{formatRs(Number(form.monthly_rent) || 0)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Additional charges</dt>
                      <dd className="font-semibold text-ink">{formatRs(extrasSum)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-1.5">
                      <dt className="font-semibold text-ink">Total monthly rent</dt>
                      <dd className="font-semibold text-ink">{formatRs(monthlyTotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Security deposit (one-time)</dt>
                      <dd className="font-semibold text-ink">{formatRs(Number(form.security_paid) || 0)}</dd>
                    </div>
                  </dl>
                </Card>
              </div>
            ) : null}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={showConfirm}
        title="Discard this resident?"
        message="You have entered details that are not saved yet. Closing now will discard them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setShowConfirm(false);
          onClose();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Residents page                                                      */
/* ------------------------------------------------------------------ */

export default function AdminResidentsPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <AdminResidentsPageContent />
    </Suspense>
  );
}

/* useSearchParams needs a Suspense boundary (Next.js App Router). */
function AdminResidentsPageContent() {
  const { t } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The header search and dashboard activity rows link here with
  // ?search= — honour it on mount and whenever it changes.
  const urlSearch = searchParams.get("search") ?? "";
  const toast = useToast();
  const [rows, setRows] = useState<ResidentRow[]>([]);
  const [pageData, setPageData] = useState<Page<ResidentRow> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [person, setPerson] = useState<PersonCardData | null>(null);
  const [personExtras, setPersonExtras] = useState<ExtraCharge[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allRooms, setAllRooms] = useState<RoomEx[]>([]);
  const [seatsByRoom, setSeatsByRoom] = useState<Record<number, Seat[]>>({});
  const [seatMap, setSeatMap] = useState<Record<number, SeatLocation>>({});

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

  // Resolve seat_id -> building/room/seat from the real endpoints.
  // Best-effort: if it fails, the table still works and shows "—".
  const buildLookup = useCallback(async () => {
    try {
      const b = await api<Page<Building>>("/api/v1/admin/buildings?page=1&page_size=100", { auth: true });
      const list = unwrapPage(b);
      setBuildings(list);
      const roomLists = await Promise.all(
        list.map((bd) =>
          api<Page<Room>>(`/api/v1/admin/buildings/${bd.id}/rooms?page=1&page_size=100`, { auth: true })
            .then((d) => unwrapPage(d).map((r) => ({ ...r, buildingId: bd.id, buildingName: bd.name })))
            .catch(() => [] as RoomEx[])
        )
      );
      const rooms = roomLists.flat();
      setAllRooms(rooms);
      const seatLists = await Promise.all(
        rooms.map((r) =>
          api<Seat[]>(`/api/v1/admin/rooms/${r.id}/seats`, { auth: true })
            .then((s) => ({ room: r, seats: s }))
            .catch(() => ({ room: r, seats: [] as Seat[] }))
        )
      );
      const byRoom: Record<number, Seat[]> = {};
      const map: Record<number, SeatLocation> = {};
      for (const { room, seats } of seatLists) {
        byRoom[room.id] = seats;
        for (const s of seats) {
          map[s.id] = {
            building: room.buildingName,
            room: room.room_number,
            seat: s.seat_label,
            buildingId: room.buildingId,
            roomId: room.id,
          };
        }
      }
      setSeatsByRoom(byRoom);
      setSeatMap(map);
    } catch {
      // Lookup failed — table still renders; location cells show "—".
    }
  }, []);

  useEffect(() => {
    setSearch(urlSearch);
    setSearchInput(urlSearch);
    load(1, urlSearch);
  }, [load, urlSearch]);

  useEffect(() => {
    buildLookup();
  }, [buildLookup]);

  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);

  const roomsForFilter = useMemo(
    () => (buildingFilter ? allRooms.filter((r) => r.buildingId === Number(buildingFilter)) : allRooms),
    [allRooms, buildingFilter]
  );

  // Building / room / status have no backend params — filter the loaded page.
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const loc = r.seat_id != null ? seatMap[r.seat_id] : undefined;
        if (buildingFilter && loc?.buildingId !== Number(buildingFilter)) return false;
        if (roomFilter && loc?.roomId !== Number(roomFilter)) return false;
        if (statusFilter && r.status !== statusFilter) return false;
        return true;
      }),
    [rows, seatMap, buildingFilter, roomFilter, statusFilter]
  );

  const filtersActive = Boolean(search || buildingFilter || roomFilter || statusFilter);

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setBuildingFilter("");
    setRoomFilter("");
    setStatusFilter("");
    router.replace("/admin/residents");
    load(1, "");
  }

  async function openPerson(id: number) {
    try {
      const card = await api<PersonCardData>(`/api/v1/admin/residents/${id}`, { auth: true });
      setPerson(card);
      setPersonExtras(card.extras ?? []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.tryAgain;
      setError(message);
      toast.error(message);
    }
  }

  async function refreshPerson() {
    if (person) openPerson(person.id);
  }

  async function exportCsv() {
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      await downloadFile(`/api/v1/admin/residents/export${qs}`, "taqwa-residents.csv");
      toast.success("Residents CSV downloaded.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink sm:text-[30px]">
            {t.residents}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Everyone living in the hostel. Search by name, phone or CNIC. Monthly total = base
            rent + active extras.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="primary" icon={UserPlus} onClick={() => setShowWizard(true)}>
            Add resident
          </Button>
        </div>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      <div className="mb-4">
        <Toolbar>
          <form
            className="flex w-full max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // Keep the URL in sync so the list reloads from ?search=
              // (same path the header search and activity rows use).
              const q = searchInput.trim();
              router.replace(q ? `/admin/residents?search=${encodeURIComponent(q)}` : "/admin/residents");
            }}
          >
            <SearchInput
              label="Search name, phone or CNIC"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter by building"
              value={buildingFilter}
              onChange={(e) => {
                setBuildingFilter(e.target.value);
                setRoomFilter("");
              }}
              options={[
                { value: "", label: "All buildings" },
                ...buildings.map((b) => ({ value: String(b.id), label: b.name })),
              ]}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter by room"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              options={[
                { value: "", label: "All rooms" },
                ...roomsForFilter.map((r) => ({
                  value: String(r.id),
                  label: `Room ${r.room_number} · ${r.buildingName}`,
                })),
              ]}
            />
          </div>
          <div className="w-full sm:w-40">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All statuses" },
                ...statusOptions.map((s) => ({ value: s, label: s.replaceAll("_", " ") })),
              ]}
            />
          </div>
          {filtersActive ? (
            <Button variant="tertiary" icon={X} onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </Toolbar>
        <p className="mt-2 text-xs text-muted">
          Building, room and status filters apply to the residents shown on this page.
        </p>
      </div>

      {loading ? (
        <Loading label={t.loading} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No residents found"
          description={
            filtersActive
              ? "Try a different search or clear the filters."
              : "No residents yet. Invite them from the Applications page, or add one manually."
          }
          action={
            filtersActive ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" icon={UserPlus} onClick={() => setShowWizard(true)}>
                Add resident
              </Button>
            )
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Resident</TableHeadCell>
                  <TableHeadCell>Phone</TableHeadCell>
                  <TableHeadCell>Building</TableHeadCell>
                  <TableHeadCell>Room</TableHeadCell>
                  <TableHeadCell>Seat</TableHeadCell>
                  <TableHeadCell>Monthly rent</TableHeadCell>
                  <TableHeadCell>Due date</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>
                    <span className="sr-only">Actions</span>
                  </TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => {
                  const loc = r.seat_id != null ? seatMap[r.seat_id] : undefined;
                  const total = r.monthly_total ?? r.monthly_rent;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => openPerson(r.id)}
                          className="flex items-center gap-3 text-left"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-active text-sm font-semibold text-brand"
                            aria-hidden
                          >
                            {initials(r.full_name)}
                          </span>
                          <span className="font-semibold text-ink hover:underline">{r.full_name}</span>
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.phone}</TableCell>
                      <TableCell>{loc?.building ?? "—"}</TableCell>
                      <TableCell>{loc ? `Room ${loc.room}` : "—"}</TableCell>
                      <TableCell>{loc?.seat ?? "—"}</TableCell>
                      <TableCell>
                        <span className="block font-semibold text-ink">{formatRs(total)}/mo</span>
                        {(r.extras_total ?? 0) > 0 ? (
                          <span className="block text-xs text-muted">
                            {formatRs(r.monthly_rent)} base + {formatRs(r.extras_total)} extras
                          </span>
                        ) : (
                          <span className="block text-xs text-muted">Base rent</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.next_due_date)}</TableCell>
                      <TableCell>
                        <StatusPill status={r.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu
                          label={`Actions for ${r.full_name}`}
                          trigger={<IconButton label="More actions" icon={MoreHorizontal} />}
                        >
                          <DropdownMenuItem icon={Eye} onSelect={() => openPerson(r.id)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            icon={MessageCircle}
                            onSelect={() => window.open(waLink(r.phone), "_blank", "noopener")}
                          >
                            Remind on WhatsApp
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {filtered.length} of {pageData?.total ?? rows.length} residents
              {filtersActive ? " matching the filters on this page" : ""}
            </p>
            {pageData ? (
              <Pagination page={page} pages={pageData.pages} total={pageData.total} onPage={(p) => load(p, search)} />
            ) : null}
          </div>
        </>
      )}

      {person ? (
        <Modal title={person.full_name} size="lg" onClose={() => setPerson(null)}>
          <PersonCard person={{ ...person, extras: personExtras }} />
          <Card className="mt-4">
            <ExtrasManager residentId={person.id} extras={personExtras} onChanged={refreshPerson} />
          </Card>
        </Modal>
      ) : null}

      {showWizard ? (
        <AddResidentWizard
          buildings={buildings}
          allRooms={allRooms}
          seatsByRoom={seatsByRoom}
          onClose={() => setShowWizard(false)}
          onAdded={() => {
            load(1, search);
            buildLookup();
          }}
        />
      ) : null}
    </AdminShell>
  );
}
