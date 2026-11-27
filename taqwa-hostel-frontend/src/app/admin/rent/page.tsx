/* Admin rent: who paid and who is due. Paid is green, due soon is
   yellow, overdue is red. Reminders are plain wa.me links from the
   backend — no WhatsApp API. */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Wallet } from "lucide-react";
import { api, ApiError, formatDate, formatRs } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import {
  DataTable,
  EmptyState,
  ErrorBox,
  Loading,
  MetricCard,
  SearchInput,
  SectionTitle,
  StatusPill,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Toolbar,
} from "@/components/ui";

interface DueRow {
  resident_id: number;
  full_name: string;
  phone: string;
  guardian_phone?: string;
  monthly_rent?: number;
  extras_total?: number;
  monthly_total?: number;
  extras?: { name: string; monthly_amount: number; is_active: boolean }[];
  building_name?: string | null;
  portion_name?: string | null;
  room_number?: string | null;
  seat_label?: string | null;
  whatsapp_url?: string;
  cycle: {
    due_date: string;
    total_amount: number;
    base_amount?: number;
    extras_amount?: number;
    paid_amount: number;
    remaining: number;
    status: string;
  };
}
interface PaidRow {
  resident_id: number;
  full_name: string;
  phone: string;
  monthly_rent?: number;
  extras_total?: number;
  monthly_total?: number;
  cycle: {
    due_date: string;
    total_amount: number;
    base_amount?: number;
    extras_amount?: number;
    paid_amount: number;
    status: string;
  };
}

const FILTERS = ["all", "due", "due_soon", "overdue"] as const;

export default function AdminRentPage() {
  const { t } = useLang();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [due, setDue] = useState<DueRow[]>([]);
  const [paid, setPaid] = useState<PaidRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        api<DueRow[]>(`/api/v1/admin/rent/due-list?status=${filter}`, { auth: true }),
        api<PaidRow[]>("/api/v1/admin/rent/paid-list", { auth: true }),
      ]);
      setDue(d);
      setPaid(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const dueFiltered = useMemo(
    () => (q ? due.filter((r) => r.full_name.toLowerCase().includes(q) || r.phone.includes(q)) : due),
    [due, q]
  );
  const paidFiltered = useMemo(
    () => (q ? paid.filter((r) => r.full_name.toLowerCase().includes(q) || r.phone.includes(q)) : paid),
    [paid, q]
  );
  const overdueCount = due.filter((r) => r.cycle.status === "overdue").length;
  const totalRemaining = due.reduce((sum, r) => sum + (r.cycle.remaining || 0), 0);

  return (
    <AdminShell>
      <SectionTitle
        eyebrow={t.admin}
        title={t.rent}
        sub="Who still owes rent and who has paid. Due date is start date + 30 days."
      />
      {error ? <ErrorBox message={error} /> : null}
      <Toolbar className="mb-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Rent status filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`inline-flex h-11 items-center rounded-btn px-4 text-sm font-semibold ${
                filter === f
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink hover:bg-page"
              }`}
            >
              {f === "all" ? "All due" : t[f as keyof typeof t] ?? f}
            </button>
          ))}
        </div>
        <SearchInput
          label="Search by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Toolbar>
      {loading ? (
        <Loading label={t.loading} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <MetricCard icon={Wallet} label="Due now" value={due.length} sub={`${overdueCount} overdue`} />
            <MetricCard icon={Wallet} label="Total remaining" value={formatRs(totalRemaining)} sub="Across all due cycles" />
            <MetricCard icon={Wallet} label="Paid cycles" value={paid.length} sub="Fully paid this period" />
          </div>

          <h2 className="mb-3 text-lg font-semibold text-ink">Due ({dueFiltered.length})</h2>
          {dueFiltered.length === 0 ? (
            <EmptyState icon={Wallet} title="Nobody is due in this filter." />
          ) : (
            <DataTable>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Resident</TableHeadCell>
                  <TableHeadCell>Room</TableHeadCell>
                  <TableHeadCell>Due date</TableHeadCell>
                  <TableHeadCell>Remaining / total</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Reminder</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dueFiltered.map((r) => (
                  <TableRow key={r.resident_id}>
                    <TableCell>
                      <span className="block font-semibold">{r.full_name}</span>
                      <span className="block text-xs text-muted">{r.phone}</span>
                    </TableCell>
                    <TableCell>
                      {r.building_name ?? "—"}
                      {r.room_number ? ` · Room ${r.room_number}` : ""}
                    </TableCell>
                    <TableCell>{formatDate(r.cycle.due_date)}</TableCell>
                    <TableCell>
                      <span className="block font-semibold">{formatRs(r.cycle.remaining)}</span>
                      <span className="block text-xs text-muted">
                        of {formatRs(r.cycle.total_amount)} · Base{" "}
                        {formatRs(r.cycle.base_amount ?? r.monthly_rent)} + extras{" "}
                        {formatRs(r.cycle.extras_amount ?? r.extras_total ?? 0)}
                        {r.extras && r.extras.filter((e) => e.is_active).length > 0
                          ? ` (${r.extras
                              .filter((e) => e.is_active)
                              .map((e) => `${e.name} ${formatRs(e.monthly_amount)}`)
                              .join(", ")})`
                          : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={r.cycle.status} />
                    </TableCell>
                    <TableCell>
                      {r.whatsapp_url ? (
                        <a
                          href={r.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-btn border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-page"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden />
                          {t.remindWhatsApp}
                        </a>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}

          <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">Paid ({paidFiltered.length})</h2>
          {paidFiltered.length === 0 ? (
            <EmptyState icon={Wallet} title="No fully-paid cycles yet." />
          ) : (
            <DataTable>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Resident</TableHeadCell>
                  <TableHeadCell>Due date</TableHeadCell>
                  <TableHeadCell>Paid</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paidFiltered.slice(0, 30).map((r, i) => (
                  <TableRow key={`${r.resident_id}-${i}`}>
                    <TableCell>
                      <span className="block font-semibold">{r.full_name}</span>
                      <span className="block text-xs text-muted">{r.phone}</span>
                    </TableCell>
                    <TableCell>{formatDate(r.cycle.due_date)}</TableCell>
                    <TableCell>
                      <span className="block font-semibold">{formatRs(r.cycle.paid_amount)}</span>
                      <span className="block text-xs text-muted">
                        Base {formatRs(r.cycle.base_amount ?? r.monthly_rent)} + extras{" "}
                        {formatRs(r.cycle.extras_amount ?? r.extras_total ?? 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status="paid" label={t.paid} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}
        </>
      )}
    </AdminShell>
  );
}
