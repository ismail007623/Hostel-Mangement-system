/* STATIC PREVIEW DATA — INTERIM ONLY.
 *
 * The dashboard chart, rent donut, recent activity, bell counts and
 * the two new KPI sub-lines below are SAMPLE numbers (from the
 * approved preview design) shown until the backend endpoints are
 * built. They are NOT real hostel data. The dashboard page labels
 * them "Sample" on screen.
 *
 * WHEN THE BACKEND IS READY, replace exactly this file's contents
 * with live data — one widget at a time:
 * - chartMonths (rent collected + residents joined, last 6 months)
 *   <- GET /api/v1/admin/dashboard/monthly-series?months=6
 * - donut.pending / donut.overdue
 *   <- GET /api/v1/admin/dashboard fields `due_amount`, `overdue_amount`
 *   (donut.collected stays live: `paid_amount_this_month`)
 * - activity <- GET /api/v1/admin/dashboard/recent-activity?limit=8
 * - pendingPayments / pendingApplications
 *   <- GET /api/v1/admin/dashboard fields `pending_payments_count`,
 *      `pending_applications_count`
 * - newResidentsThisMonth
 *   <- GET /api/v1/admin/dashboard field `new_residents_this_month`
 * - roomsWithVacancy
 *   <- GET /api/v1/admin/dashboard field `rooms_with_vacancy`
 *
 * Nothing else in the frontend reads sample data. KPI card numbers,
 * the greeting, the header search and all links are live today.
 */

export interface StaticActivityItem {
  id: string;
  type: "resident_created" | "payment_approved" | "application_created";
  title: string;
  detail: string;
  /** Minutes before now, so the relative time ("10 minutes ago") stays fresh. */
  minutesAgo: number;
}

export const STATIC_PREVIEW = {
  /** Sample: new residents this month (KPI sub-line). */
  newResidentsThisMonth: 3,
  /** Sample: rooms that have at least one vacant seat (KPI sub-line). */
  roomsWithVacancy: 3,
  /** Sample: last 6 months, oldest first. Labels are derived from the
      current month at render time, so they never go stale. */
  chartMonths: [
    { rentCollected: 42000, residentsJoined: 2 },
    { rentCollected: 48000, residentsJoined: 1 },
    { rentCollected: 51000, residentsJoined: 4 },
    { rentCollected: 44000, residentsJoined: 2 },
    { rentCollected: 53000, residentsJoined: 3 },
    { rentCollected: 56000, residentsJoined: 3 },
  ],
  /** Sample: whole donut is sample (see file header — mixing the live
      collected amount with sample pending/overdue would make the
      "Total Due" sum meaningless). */
  donut: {
    collected: 56000,
    pending: 18000,
    overdue: 9000,
  },
  /** Sample: bell badge = pendingPayments + pendingApplications = 5. */
  pendingPayments: 2,
  pendingApplications: 3,
  /** Sample activity, newest first. */
  activity: [
    {
      id: "sample-1",
      type: "resident_created",
      title: "New resident added: Ali Raza",
      detail: "Phone 0300 1234567",
      minutesAgo: 10,
    },
    {
      id: "sample-2",
      type: "payment_approved",
      title: "Rent payment received: Rs 8,000",
      detail: "Ali Raza",
      minutesAgo: 25,
    },
    {
      id: "sample-3",
      type: "application_created",
      title: "New application: Sara Ahmed",
      detail: "Phone 0321 7654321",
      minutesAgo: 120,
    },
    {
      id: "sample-4",
      type: "payment_approved",
      title: "Rent payment received: Rs 8,000",
      detail: "Bilal Hussain",
      minutesAgo: 300,
    },
    {
      id: "sample-5",
      type: "resident_created",
      title: "New resident added: Usman Ghani",
      detail: "Phone 0301 9876543",
      minutesAgo: 1440,
    },
    {
      id: "sample-6",
      type: "application_created",
      title: "New application: Hassan Ali",
      detail: "Phone 0333 1122334",
      minutesAgo: 2880,
    },
  ] as StaticActivityItem[],
};
