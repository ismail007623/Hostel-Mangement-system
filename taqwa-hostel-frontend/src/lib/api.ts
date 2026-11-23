/* API client for the Taqwa backend (FastAPI, Xeven envelope).
   All calls go through the Next.js /api proxy (see next.config.js),
   so the browser never makes a cross-origin request.
   Backend errors are never shown raw — only the backend's own
   generic message, or a fixed fallback, reaches the screen. */

export interface Envelope<T> {
  succeed: boolean;
  status: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

export interface Session {
  accessToken: string;
  refreshToken: string;
  role: string;
  userId: number;
  hostelId: number;
  fullName: string;
}

const SESSION_KEY = "taqwa-session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

async function refreshAccessToken(session: Session): Promise<Session | null> {
  try {
    const res = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    const body = (await res.json()) as Envelope<Record<string, unknown>>;
    if (!res.ok || !body.succeed) return null;
    const next: Session = {
      accessToken: String(body.data.access_token),
      refreshToken: String(body.data.refresh_token),
      role: String(body.data.role),
      userId: Number(body.data.user_id),
      hostelId: Number(body.data.hostel_id),
      fullName: String(body.data.full_name),
    };
    saveSession(next);
    return next;
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    formData?: FormData;
    auth?: boolean;
    retry?: boolean;
  } = {}
): Promise<T> {
  const session = loadSession();
  const headers: Record<string, string> = {};
  if (options.formData) {
    // Browser sets the multipart boundary itself.
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth && session) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError("No connection to the server. Please check your internet and try again.", 0);
  }
  if (res.status === 401 && options.auth && session && options.retry !== false) {
    const next = await refreshAccessToken(session);
    if (next) return api<T>(path, { ...options, retry: false });
    clearSession();
    throw new ApiError("Your session ended. Please log in again.", 401);
  }
  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(FALLBACK_MESSAGE, res.status);
  }
  if (!res.ok || !body.succeed) {
    throw new ApiError(body.message || FALLBACK_MESSAGE, res.status);
  }
  return body.data;
}

/** POST /login — role comes from the database, never from the client. */
export async function login(phone: string, password: string): Promise<Session> {
  const data = await api<Record<string, unknown>>("/api/v1/auth/login", {
    method: "POST",
    body: { phone, password },
  });
  const session: Session = {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    role: String(data.role),
    userId: Number(data.user_id),
    hostelId: Number(data.hostel_id),
    fullName: String(data.full_name),
  };
  saveSession(session);
  return session;
}

export function logout(): void {
  clearSession();
  window.location.href = "/login";
}

/** Pakistani mobile (03XXXXXXXXX) to wa.me international form. */
export function waLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
  return message ? `https://wa.me/${intl}?text=${encodeURIComponent(message)}` : `https://wa.me/${intl}`;
}

export function formatRs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—";
  return `Rs ${Number(amount).toLocaleString("en-PK")}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
