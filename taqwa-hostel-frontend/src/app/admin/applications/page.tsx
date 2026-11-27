/* Admin applications: invite link (Qari sends it on WhatsApp himself),
   list applications, approve with a vacant-seat assignment, or reject.
   Approving creates the resident login — before that, login is not
   possible. The approve picker only ever lists vacant seats.
   The list endpoint takes no status parameter and returns a plain
   (unpaginated) array, so the status tabs and pagination below are
   client-side over the loaded list. */

"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, Inbox, Link2, MessageCircle, Plus, UserPlus } from "lucide-react";
import { api, ApiError, formatDate, formatRs, unwrapPage, type Page } from "@/lib/api";
import { EXTRA_PRESETS } from "@/components/ExtraCharges";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorBox,
  Input,
  Loading,
  Modal,
  Pagination,
  Select,
  StatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Toolbar,
  useToast,
} from "@/components/ui";

interface Application {
  id: number;
  full_name: string;
  phone: string;
  cnic_number: string;
  start_date: string;
  monthly_rent: number;
  security_paid: number;
  status: string;
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

type StatusTab = "all" | "pending" | "approved" | "rejected";

const TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const PAGE_SIZE = 10;

export default function AdminApplicationsPage() {
  const { t } = useLang();
  const toast = useToast();
  const [rows, setRows] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("all");
  const [page, setPage] = useState(1);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Approve / reject (inline expansion under a table row)
  const [approving, setApproving] = useState<number | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatId, setSeatId] = useState("");
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [extraOn, setExtraOn] = useState<Record<string, boolean>>({});
  const [extraAmount, setExtraAmount] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<Application[]>("/api/v1/admin/applications", { auth: true }));
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
    if (approving !== null) api<Page<Building>>("/api/v1/admin/buildings?page=1&page_size=100", { auth: true }).then((d) => setBuildings(unwrapPage(d))).catch(() => undefined);
  }, [approving]);

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

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { all: rows.length, pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === "pending") c.pending += 1;
      else if (r.status === "approved") c.approved += 1;
      else if (r.status === "rejected") c.rejected += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab]
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function selectTab(next: StatusTab) {
    setTab(next);
    setPage(1);
    setApproving(null);
    setRejecting(null);
    setActionError("");
  }

  function openInvite() {
    setInvitePhone("");
    setInviteLink("");
    setInviteError("");
    setCopied(false);
    setInviteOpen(true);
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteLink("");
    setInvitePhone("");
    setInviteError("");
    setCopied(false);
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSaving(true);
    try {
      const data = await api<{ invite_link: string }>("/api/v1/admin/applications/invite", {
        method: "POST",
        auth: true,
        body: { phone: invitePhone.trim() },
      });
      setInviteLink(data.invite_link);
      setInvitePhone("");
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setInviteSaving(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("Could not copy the link. Please copy it by hand.");
    }
  }

  function startApprove(id: number) {
    setRejecting(null);
    setActionError("");
    setBuildingId("");
    setRooms([]);
    setRoomId("");
    setSeats([]);
    setSeatId("");
    setExtraOn({});
    setExtraAmount({});
    setApproving(id);
  }

  function startReject(id: number) {
    setApproving(null);
    setActionError("");
    setRejectReason("");
    setRejecting(id);
  }

  async function approve(id: number) {
    if (!seatId) return;
    const extras = EXTRA_PRESETS.filter((p) => extraOn[p] && Number(extraAmount[p]) > 0).map((p) => ({
      name: p,
      monthly_amount: Number(extraAmount[p]),
    }));
    setActionError("");
    setActionSaving(true);
    try {
      await api(`/api/v1/admin/applications/${id}/approve`, {
        method: "POST",
        auth: true,
        body: { seat_id: Number(seatId), extras },
      });
      setApproving(null);
      setExtraOn({});
      setExtraAmount({});
      toast.success(t.saved);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setActionSaving(false);
    }
  }

  async function reject(id: number) {
    setActionError("");
    setActionSaving(true);
    try {
      await api(`/api/v1/admin/applications/${id}/reject`, {
        method: "POST",
        auth: true,
        body: { reason: rejectReason || null },
      });
      setRejecting(null);
      setRejectReason("");
      toast.success(t.saved);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setActionSaving(false);
    }
  }

  const waShareHref = inviteLink
    ? `https://wa.me/?text=${encodeURIComponent(`Your hostel invite link: ${inviteLink}`)}`
    : "";

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink sm:text-[30px]">{t.applications}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Invite residents, then approve them with a vacant seat or reject them. Login starts only after approval.
          </p>
        </div>
        <Button icon={UserPlus} onClick={openInvite}>
          Invite resident
        </Button>
      </div>

      {error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}

      <Toolbar className="mb-4" aria-label="Filter applications by status">
        {TABS.map((tb) => (
          <button
            key={tb.value}
            type="button"
            aria-pressed={tab === tb.value}
            onClick={() => selectTab(tb.value)}
            className={`inline-flex h-11 items-center gap-2 rounded-btn border px-4 text-sm font-semibold transition-colors ${
              tab === tb.value
                ? "border-brand bg-active text-brand"
                : "border-line bg-white text-ink hover:bg-page"
            }`}
          >
            {tb.label}
            <span
              className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                tab === tb.value ? "bg-brand text-white" : "bg-page text-muted"
              }`}
            >
              {counts[tb.value]}
            </span>
          </button>
        ))}
      </Toolbar>

      {loading ? (
        <Loading label={t.loading} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No applications yet"
          description="Invite a resident to apply. They fill the form, and you approve them and give them a seat."
          action={<Button icon={UserPlus} onClick={openInvite}>Create invitation</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={`No ${tab} applications`}
          description="Try a different status tab to see more applications."
          action={<Button variant="secondary" onClick={() => selectTab("all")}>Show all applications</Button>}
        />
      ) : (
        <>
          <DataTable>
            <TableHead>
              <TableRow>
                <TableHeadCell>Applicant</TableHeadCell>
                <TableHeadCell>Phone</TableHeadCell>
                <TableHeadCell>CNIC</TableHeadCell>
                <TableHeadCell>Start date</TableHeadCell>
                <TableHeadCell>Rent</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((a) => (
                <Fragment key={a.id}>
                  <TableRow>
                    <TableCell className="font-semibold">{a.full_name}</TableCell>
                    <TableCell>{a.phone}</TableCell>
                    <TableCell>{a.cnic_number}</TableCell>
                    <TableCell>{formatDate(a.start_date)}</TableCell>
                    <TableCell>{formatRs(a.monthly_rent)}/mo</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} label={t[a.status as keyof typeof t] ?? a.status} />
                    </TableCell>
                    <TableCell>
                      {a.status === "pending" ? (
                        <span className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => startApprove(a.id)}
                            className="text-sm font-semibold text-brand hover:underline"
                          >
                            {t.approve}
                          </button>
                          <button
                            type="button"
                            onClick={() => startReject(a.id)}
                            className="text-sm font-semibold text-danger hover:underline"
                          >
                            {t.reject}
                          </button>
                        </span>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {approving === a.id ? (
                    <TableRow key={`${a.id}-approve`}>
                      <td colSpan={7} className="bg-page px-4 py-3 align-top text-ink">
                        <div className="grid gap-3 py-1">
                          {actionError ? <ErrorBox message={actionError} /> : null}
                          <div className="grid gap-2 sm:grid-cols-4">
                            <Select
                              label="Building"
                              value={buildingId}
                              onChange={(e) => setBuildingId(e.target.value)}
                              options={[
                                { value: "", label: "Building" },
                                ...buildings.map((b) => ({ value: String(b.id), label: b.name })),
                              ]}
                            />
                            <Select
                              label="Room"
                              value={roomId}
                              onChange={(e) => setRoomId(e.target.value)}
                              options={[
                                { value: "", label: "Room" },
                                ...rooms.map((r) => ({ value: String(r.id), label: `Room ${r.room_number}` })),
                              ]}
                            />
                            <Select
                              label="Vacant seat"
                              value={seatId}
                              onChange={(e) => setSeatId(e.target.value)}
                              options={[
                                { value: "", label: "Vacant seat" },
                                ...seats.map((s) => ({ value: String(s.id), label: s.seat_label })),
                              ]}
                            />
                            <span className="flex items-end">
                              <Button
                                type="button"
                                disabled={!seatId}
                                loading={actionSaving}
                                onClick={() => approve(a.id)}
                              >
                                {t.approve}
                              </Button>
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-ink">
                            Extra charges (optional — apply from the first cycle):
                          </p>
                          <div className="flex flex-wrap gap-4">
                            {EXTRA_PRESETS.map((p) => (
                              <label key={p} className="flex items-center gap-2 text-sm font-medium text-ink">
                                <input
                                  type="checkbox"
                                  checked={!!extraOn[p]}
                                  onChange={(e) => setExtraOn((o) => ({ ...o, [p]: e.target.checked }))}
                                  className="h-4 w-4 accent-brand"
                                />
                                {p}
                                <input
                                  className="h-11 w-24 rounded-lg border border-line bg-white px-3 text-[15px] text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand-50 disabled:bg-slate-50 disabled:text-muted"
                                  type="number"
                                  min={1}
                                  placeholder="Rs/mo"
                                  disabled={!extraOn[p]}
                                  value={extraAmount[p] ?? ""}
                                  onChange={(e) => setExtraAmount((x) => ({ ...x, [p]: e.target.value }))}
                                />
                              </label>
                            ))}
                          </div>
                          <div>
                            <Button variant="secondary" type="button" onClick={() => setApproving(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </td>
                    </TableRow>
                  ) : null}
                  {rejecting === a.id ? (
                    <TableRow key={`${a.id}-reject`}>
                      <td colSpan={7} className="bg-page px-4 py-3 align-top text-ink">
                        <div className="grid gap-3 py-1">
                          {actionError ? <ErrorBox message={actionError} /> : null}
                          <Input
                            label={t.reason}
                            placeholder={t.reason}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="max-w-sm"
                          />
                          <div className="flex gap-2">
                            <Button variant="destructive" loading={actionSaving} onClick={() => reject(a.id)}>
                              {t.reject}
                            </Button>
                            <Button variant="secondary" type="button" onClick={() => setRejecting(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </td>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </DataTable>
          {pages > 1 ? (
            <div className="mt-4">
              <Pagination page={safePage} pages={pages} total={filtered.length} onPage={setPage} />
            </div>
          ) : null}
        </>
      )}

      {inviteOpen ? (
        <Modal title="Invite a resident" onClose={closeInvite}>
          <div className="grid gap-4">
            <p className="text-sm text-muted">
              Create an invite link, then send it on WhatsApp yourself. The resident fills the form; you approve and
              give a seat.
            </p>
            {inviteError ? <ErrorBox message={inviteError} /> : null}
            {inviteLink ? (
              <div className="grid gap-3">
                <p className="flex items-start gap-2 break-all rounded-card border border-line bg-page px-3 py-2 text-sm font-medium text-ink">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  {inviteLink}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" icon={copied ? Check : Copy} onClick={copyLink}>
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                  <a
                    href={waShareHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Share on WhatsApp
                  </a>
                </div>
                <div className="flex justify-end">
                  <Button variant="secondary" type="button" onClick={closeInvite}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={invite} className="grid gap-4">
                <Input
                  label="Phone number"
                  required
                  pattern="^03\d{9}$"
                  placeholder="0300XXXXXXX"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  helperText="Pakistani mobile number, starting with 03."
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" type="button" onClick={closeInvite}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={inviteSaving} icon={Plus}>
                    Create invite link
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      ) : null}
    </AdminShell>
  );
}
