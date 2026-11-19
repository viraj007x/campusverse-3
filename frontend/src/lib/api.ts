export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = RequestInit & { json?: unknown };

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(detail || "Request failed", res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function fileUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${API}${path}`;
}

function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Backend serialises naive UTC timestamps; treat them as UTC explicitly
  const naiveUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value);
  return new Date(naiveUtc ? `${value}Z` : value);
}

export function timeAgo(value: string | Date): string {
  const date = parseDate(value);
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date): string {
  const date = parseDate(value);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
