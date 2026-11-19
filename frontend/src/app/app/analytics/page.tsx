"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BookOpenText,
  Clock,
  Database,
  PackageCheck,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { api, formatDateTime, timeAgo } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";

type Analytics = {
  system: {
    llm_mode: string;
    chunks: number;
    documents: number;
    avg_latency_ms: number;
    qa_pairs: number;
    mode_split: { mode: string; count: number }[];
  };
  chat_daily: { date: string; count: number }[];
  top_sources: { title: string; count: number }[];
  recent_questions: { question: string; user: string; mode: string; latency_ms: number; created_at: string }[];
  attendance: { code: string; title: string; sessions: number; present: number; possible: number; rate: number }[];
  footfall: { zone: string; series: { t: string; count: number }[] }[];
  lost_found: { lost: number; found: number; matched: number; resolved: number };
};

const ZONE_COLORS = ["#e42527", "#1570ef", "#12b76a"];
const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-ink)",
  boxShadow: "0 8px 24px -12px rgba(16, 24, 40, 0.25)",
} as const;

function shortDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function clock(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await api<Analytics>("/api/analytics"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const attendanceTotals = useMemo(() => {
    if (!data) return { present: 0, possible: 0, rate: 0 };
    const present = data.attendance.reduce((a, c) => a + c.present, 0);
    const possible = data.attendance.reduce((a, c) => a + c.possible, 0);
    return { present, possible, rate: possible ? Math.round((100 * present) / possible) : 0 };
  }, [data]);

  const footfallRows = useMemo(() => {
    if (!data || data.footfall.length === 0) return { rows: [], zones: [] };
    const zones = data.footfall.map((z) => z.zone);
    const longest = data.footfall.reduce((a, b) => (a.series.length >= b.series.length ? a : b));
    const rows = longest.series.map((point, i) => {
      const row: Record<string, string | number | null> = { label: clock(point.t) };
      for (const zone of data.footfall) row[zone.zone] = zone.series[i]?.count ?? null;
      return row;
    });
    return { rows, zones };
  }, [data]);

  const modeTotal = data ? data.system.mode_split.reduce((a, m) => a + m.count, 0) : 0;
  const lfTotal = data ? data.lost_found.lost + data.lost_found.found : 0;
  const lfResolution = data && lfTotal ? Math.round((100 * data.lost_found.resolved) / lfTotal) : 0;
  const maxSource = data ? Math.max(1, ...data.top_sources.map((s) => s.count)) : 1;

  return (
    <div>
      <PageHeader
        eyebrow="Campus Operations · Insights"
        title="Analytics"
        description="Cross-module engagement: copilot usage, attendance health, footfall patterns and lost-and-found recovery."
        actions={
          <Button variant="secondary" size="sm" onClick={load} loading={refreshing}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {error && <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {!data ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4" /> Loading analytics…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Knowledge base"
              value={data.system.documents}
              hint={`${data.system.chunks} indexed chunks`}
              icon={<Database className="h-5 w-5" />}
            />
            <StatCard
              label="SAMVIT questions"
              value={data.system.qa_pairs}
              hint={`${data.system.avg_latency_ms} ms avg latency`}
              icon={<BookOpenText className="h-5 w-5" />}
              tone="accent"
            />
            <StatCard
              label="Attendance rate"
              value={`${attendanceTotals.rate}%`}
              hint={`${attendanceTotals.present}/${attendanceTotals.possible} check-ins`}
              icon={<Users className="h-5 w-5" />}
              tone={attendanceTotals.rate >= 75 ? "success" : "warn"}
            />
            <StatCard
              label="Lost & found recovery"
              value={`${lfResolution}%`}
              hint={`${data.lost_found.matched} matched · ${data.lost_found.resolved} resolved`}
              icon={<PackageCheck className="h-5 w-5" />}
              tone="brand"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <div className="flex items-center justify-between">
                <CardTitle>SAMVIT volume · last 14 days</CardTitle>
                <Badge tone="success">
                  <Sparkles className="h-3 w-3" /> {data.system.llm_mode === "offline" ? "local engine" : data.system.llm_mode}
                </Badge>
              </div>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chat_daily} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chatFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => shortDate(String(v))} cursor={{ stroke: "var(--color-line-strong)" }} />
                    <Area type="monotone" dataKey="count" name="questions" stroke="var(--color-brand)" strokeWidth={2} fill="url(#chatFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {data.system.mode_split.map((m) => (
                  <Badge key={m.mode} tone={m.mode === "offline" ? "neutral" : "accent"}>
                    {m.mode === "offline" ? "local" : m.mode}: {m.count} ({modeTotal ? Math.round((100 * m.count) / modeTotal) : 0}%)
                  </Badge>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[10.5px] text-slate-400">
                  <Clock className="h-3 w-3" /> live from chat logs
                </span>
              </div>
            </Card>

            <Card>
              <CardTitle>Top cited sources</CardTitle>
              <div className="mt-4 space-y-3">
                {data.top_sources.map((s, i) => (
                  <div key={s.title}>
                    <div className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="truncate text-slate-700">{s.title}</span>
                      <span className="shrink-0 font-mono text-slate-500">{s.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
                        style={{ width: `${(s.count / maxSource) * 100}%`, opacity: 1 - i * 0.12 }}
                      />
                    </div>
                  </div>
                ))}
                {data.top_sources.length === 0 && (
                  <p className="py-8 text-center text-[11.5px] text-slate-400">No citations recorded yet.</p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance by course</CardTitle>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-4 space-y-3.5">
                {data.attendance.map((c) => (
                  <div key={c.code}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="truncate text-slate-700">
                        <span className="font-mono text-[10.5px] text-slate-500">{c.code}</span> · {c.title}
                      </span>
                      <span className={cn("font-mono", c.rate >= 75 ? "text-emerald-600" : "text-amber-600")}>{c.rate}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full", c.rate >= 75 ? "bg-emerald-500" : "bg-amber-500")}
                        style={{ width: `${c.rate}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {c.present} present across {c.sessions} sessions · {c.possible} possible
                    </p>
                  </div>
                ))}
                {data.attendance.length === 0 && (
                  <p className="py-8 text-center text-[11.5px] text-slate-400">No attendance sessions yet.</p>
                )}
              </div>
            </Card>

            <Card>
              <CardTitle>Zone footfall today</CardTitle>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={footfallRows.rows} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--color-line-strong)" }} />
                    {footfallRows.zones.map((zone, i) => (
                      <Area
                        key={zone}
                        type="monotone"
                        dataKey={zone}
                        name={zone}
                        stroke={ZONE_COLORS[i % ZONE_COLORS.length]}
                        strokeWidth={1.8}
                        fill={ZONE_COLORS[i % ZONE_COLORS.length]}
                        fillOpacity={0.08}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {footfallRows.zones.map((zone, i) => (
                  <span key={zone} className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                    {zone}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardTitle>Recent SAMVIT questions</CardTitle>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead>
                    <tr className="border-b border-line/70 text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="pb-2 pr-3 font-medium">Question</th>
                      <th className="pb-2 pr-3 font-medium">Asked by</th>
                      <th className="pb-2 pr-3 font-medium">Mode</th>
                      <th className="pb-2 pr-3 text-right font-medium">Latency</th>
                      <th className="pb-2 text-right font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_questions.map((q, i) => (
                      <tr key={i} className="border-b border-line/40 last:border-0">
                        <td className="max-w-[320px] truncate py-2 pr-3 text-slate-700">{q.question}</td>
                        <td className="py-2 pr-3 text-slate-600">{q.user}</td>
                        <td className="py-2 pr-3">
                          <Badge tone={q.mode === "offline" ? "neutral" : "accent"}>{q.mode === "offline" ? "local" : q.mode}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-[10.5px] text-slate-500">{q.latency_ms} ms</td>
                        <td className="py-2 text-right text-[10.5px] text-slate-400">{timeAgo(q.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recent_questions.length === 0 && (
                  <EmptyState title="No questions yet" description="Ask something in the copilot to populate this table." />
                )}
              </div>
            </Card>

            <Card>
              <CardTitle>Lost & found funnel</CardTitle>
              <div className="mt-4 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Lost", value: data.lost_found.lost },
                      { name: "Found", value: data.lost_found.found },
                      { name: "Matched", value: data.lost_found.matched },
                      { name: "Resolved", value: data.lost_found.resolved },
                    ]}
                    margin={{ top: 4, right: 4, left: -26, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--color-faint)", fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(16,24,40,0.04)" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {["#f79009", "#12b76a", "#e42527", "#1570ef"].map((color, i) => (
                        <Cell key={i} fill={color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2 border-t border-line/70 pt-3 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total reports</span>
                  <span className="text-slate-800">{lfTotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Visual matches</span>
                  <span className="text-brand">{data.lost_found.matched}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Resolved claims</span>
                  <span className="text-emerald-600">{data.lost_found.resolved}</span>
                </div>
                <p className="flex items-center gap-1 pt-1 text-[10px] text-slate-400">
                  <Activity className="h-3 w-3" /> Updated {formatDateTime(new Date())}
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
