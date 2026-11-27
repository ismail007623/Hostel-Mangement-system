/* Person card: what Qari sees when he clicks a room, then a person.
   Name, father name, start date, phone, guardian phone, security
   paid, monthly rent, due date. */

import { formatDate, formatRs } from "@/lib/api";
import { Card, StatusPill } from "./ui";
import { ExtrasBreakdown, type ExtraCharge } from "./ExtraCharges";

export interface PersonCardData {
  id: number;
  full_name: string;
  father_name: string;
  phone: string;
  guardian_phone: string;
  cnic_number?: string;
  start_date: string;
  next_due_date: string;
  monthly_rent: number;
  extras?: ExtraCharge[];
  extras_total?: number;
  monthly_total?: number;
  security_paid: number;
  status: string;
  building_name?: string | null;
  portion_name?: string | null;
  room_number?: string | null;
  seat_label?: string | null;
}

export default function PersonCard({ person }: { person: PersonCardData }) {
  const rows: [string, string][] = [
    ["Name", person.full_name],
    ["Father name", person.father_name],
    ["Start date", formatDate(person.start_date)],
    ["Phone", person.phone],
    ["Guardian phone", person.guardian_phone],
    ["Security paid", formatRs(person.security_paid)],
    ["Monthly rent (base)", formatRs(person.monthly_rent)],
    ["Due date", formatDate(person.next_due_date)],
  ];
  if (person.building_name || person.room_number) {
    rows.push([
      "Room",
      [person.building_name, person.portion_name, person.room_number ? `Room ${person.room_number}` : "", person.seat_label]
        .filter(Boolean)
        .join(" · "),
    ]);
  }
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-ink">{person.full_name}</h3>
          {person.building_name || person.room_number ? (
            <p className="mt-1 text-sm text-muted">
              {[person.building_name, person.room_number ? `Room ${person.room_number}` : "", person.seat_label]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <StatusPill status={person.status} />
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-active px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="text-base font-semibold text-ink">{v}</dd>
          </div>
        ))}
        <ExtrasBreakdown base={person.monthly_rent} extras={person.extras} />
      </dl>
    </Card>
  );
}
