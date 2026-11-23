/* Admin applications: invite link (Qari sends it on WhatsApp himself),
   list applications, approve with a vacant-seat assignment, or reject.
   Approving creates the resident login — before that, login is not
   possible. The approve picker only ever lists vacant seats. */

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { Card, ErrorBox, Field, Loading, PrimaryButton, SectionTitle, StatusPill, inputCls } from "@/components/ui";

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

export default function AdminApplicationsPage() {
  const { t } = useLang();
  const [rows, setRows] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [approving, setApproving] = useState<number | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatId, setSeatId] = useState("");
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
    if (approving !== null) api<Building[]>("/api/v1/admin/buildings", { auth: true }).then(setBuildings).catch(() => undefined);
  }, [approving]);

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

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const data = await api<{ invite_link: string }>("/api/v1/admin/applications/invite", {
        method: "POST",
        auth: true,
        body: { phone: invitePhone.trim() },
      });
      setInviteLink(data.invite_link);
      setInvitePhone("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function approve(id: number) {
    if (!seatId) return;
    try {
      await api(`/api/v1/admin/applications/${id}/approve`, {
        method: "POST",
        auth: true,
        body: { seat_id: Number(seatId) },
      });
      setApproving(null);
      setNotice(t.saved);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  async function reject(id: number) {
    try {
      await api(`/api/v1/admin/applications/${id}/reject`, {
        method: "POST",
        auth: true,
        body: { reason: rejectReason || null },
      });
      setRejecting(null);
      setRejectReason("");
      setNotice(t.saved);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    }
  }

  return (
    <AdminShell>
      <SectionTitle eyebrow={t.admin} title={t.applications} />
      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}

      <Card className="mb-6">
        <h3 className="font-extrabold text-pine-800">Invite a resident</h3>
        <p className="mt-1 text-sm text-slate-500">
          Create an invite link, then send it on WhatsApp yourself. The resident fills the form; you approve and give a seat.
        </p>
        <form onSubmit={invite} className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${inputCls} max-w-xs`}
            required
            pattern="^03\d{9}$"
            placeholder="0300XXXXXXX"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
          />
          <PrimaryButton type="submit">Create invite link</PrimaryButton>
        </form>
        {inviteLink ? (
          <p className="mt-3 break-all rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-pine-800">
            {inviteLink}
          </p>
        ) : null}
      </Card>

      {loading ? (
        <Loading label={t.loading} />
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-slate-500">No applications yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-extrabold text-pine-800">{a.full_name}</span>
                <span className="text-sm text-slate-500">{a.phone}</span>
                <span className="text-sm text-slate-500">{formatRs(a.monthly_rent)}/mo</span>
                <span className="text-sm text-slate-500">Start {formatDate(a.start_date)}</span>
                <span className="ml-auto">
                  <StatusPill status={a.status} label={t[a.status as keyof typeof t] ?? a.status} />
                </span>
              </div>
              {a.status === "pending" ? (
                <div className="mt-3">
                  {approving === a.id ? (
                    <div className="grid gap-2 sm:grid-cols-4">
                      <select className={inputCls} value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                        <option value="">Building</option>
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <select className={inputCls} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                        <option value="">Room</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            Room {r.room_number}
                          </option>
                        ))}
                      </select>
                      <select className={inputCls} value={seatId} onChange={(e) => setSeatId(e.target.value)}>
                        <option value="">Vacant seat</option>
                        {seats.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.seat_label}
                          </option>
                        ))}
                      </select>
                      <PrimaryButton type="button" disabled={!seatId} onClick={() => approve(a.id)}>
                        {t.approve}
                      </PrimaryButton>
                    </div>
                  ) : rejecting === a.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        className={`${inputCls} max-w-sm`}
                        placeholder={t.reason}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <PrimaryButton type="button" onClick={() => reject(a.id)}>
                        {t.reject}
                      </PrimaryButton>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <PrimaryButton type="button" onClick={() => setApproving(a.id)}>
                        {t.approve}
                      </PrimaryButton>
                      <button
                        type="button"
                        onClick={() => setRejecting(a.id)}
                        className="rounded-full border-2 border-red-600 px-5 py-3 font-bold text-red-700"
                      >
                        {t.reject}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
