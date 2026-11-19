"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Gauge,
  GraduationCap,
  HeartPulse,
  Layers,
  Lightbulb,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { api, timeAgo } from "@/lib/api";
import { Badge, Button, Card, CardTitle, EmptyState, Input, PageHeader, Select, Spinner, StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";

const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-ink)",
  boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
};
const CHART_GRID = "var(--color-line)";
const CHART_TICK = "var(--color-faint)";

const BRAND = "#e42527";
const ACCENT = "#1570ef";
const SUCCESS = "#12b76a";
const WARN = "#f79009";
const DANGER = "#f04438";

type Row = {
  id: number;
  roll_no: string;
  name: string;
  department: string;
  semester: number;
  year: number;
  attendance_pct: number;
  assignment_avg: number;
  internal_avg: number;
  ai_flag_rate: number;
  prev_backlogs: number;
  prev_sgpa: number;
  final_sgpa: number;
  risk_score: number;
  risk_label: "low" | "medium" | "high";
  practical_avg: number;
  assignment_completion: number;
  study_hours: number;
  library_visits: number;
  lms_activity: number;
  coding_skill: number;
  communication_skill: number;
  certifications: number;
  internship_months: number;
  placement_readiness: number;
  attendance_next: number;
  cluster_id: number;
  cluster_label: string;
  anomaly_flag: boolean;
  anomaly_score: number;
};

type StudentList = { total: number; page: number; size: number; pages: number; items: Row[] };

type DataSource = {
  name: string;
  provider: string;
  license: string;
  url: string;
  kind: "real" | "synthetic" | string;
  note?: string;
};

type Driver = { feature: string; label: string; impact: number; z: number; sentence: string };
type Forecast = { expected: number; delta: number; target: number; below_target: boolean; recovery_days: number; basis: string };
type SubjectRisk = { subject: string; current: number; expected: number; risk: string; gap_to_70: number };
type SkillGap = { area: string; current: number; target: number; gap_pct: number; priority: string; action: string };
type CareerFit = { role: string; fit: number; strongest: string; focus: string };
type Recommendation = { area: string; priority: string; title: string; detail: string };
type Intervention = { action: string; owner: string; priority: string };

type Detail = Row & {
  drivers: Driver[];
  cohort: { avg_sgpa: number | null; avg_attendance: number | null };
  model_risk: number;
  model_label: string;
  model_sgpa: number;
  model_basis: string;
  forecast: Forecast;
  subjects: SubjectRisk[];
  skill_gaps: SkillGap[];
  career: CareerFit[];
  recommendations: Recommendation[];
  intervention: Intervention;
  improvement_probability: number;
  cluster: { label: string; description: string };
  anomaly: { flagged: boolean; score: number };
  twin: {
    risk: { score: number; label: string; drivers: Driver[] };
    forecast: Forecast;
    skills: { coding: number; communication: number; lms: number; study_hours: number; placement_readiness: number };
    subjects: SubjectRisk[];
    skill_gaps: SkillGap[];
    career: CareerFit[];
    recommendations: Recommendation[];
    intervention: Intervention;
    improvement_probability: number;
  };
};

type Summary = {
  records: number;
  target: number;
  source: DataSource | null;
  at_risk: number;
  at_risk_pct: number;
  watch: number;
  watch_pct: number;
  avg_sgpa: number;
  avg_attendance: number;
  avg_assignment: number;
  avg_readiness: number;
  attendance_risk: number;
  attendance_risk_pct: number;
  anomalies: number;
  pass_pct: number;
  departments: number;
  ingest_ms: number;
  status: string;
};

type ModelScore = {
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  train_ms: number;
  infer_ms_per_1k: number;
};

type ClusterInfo = {
  label: string;
  count: number;
  avg_sgpa: number;
  avg_attendance: number;
  avg_readiness: number;
  avg_risk: number;
  avg_study_hours: number;
  description: string;
};

type Metrics = {
  status: string;
  version: number;
  n_rows: number;
  data_source?: DataSource;
  positive_rate: number;
  trained_at: string;
  total_train_ms: number;
  ingest_ms: number;
  models: ModelScore[];
  best: string;
  confusion: { tn: number; fp: number; fn: number; tp: number };
  regression: { name: string; r2: number; mae: number; train_ms: number };
  regressors: { name: string; r2: number; mae: number; train_ms: number }[];
  attendance_model: { name: string; r2: number; mae: number; train_ms: number };
  decision_rules: { conditions: string[]; samples: number; high_risk_pct: number }[];
  clusters: ClusterInfo[];
  anomalies: { count: number; pct: number };
  feature_names: Record<string, string>;
  feature_importances: Record<string, number>;
  extended_feature_names: Record<string, string>;
  extended_stats: Record<string, { mean: number; std: number }>;
  stats: Record<string, { mean: number; std: number }>;
  tiers: { high: number; medium: number };
};

type ModelState = {
  status: string;
  records: number;
  target: number;
  ingest_ms: number;
  error: string | null;
  metrics_ready: boolean;
  source?: DataSource | null;
};

type Cohorts = {
  risk_by_dept: {
    department: string;
    low: number;
    medium: number;
    high: number;
    total: number;
    avg_sgpa: number;
    avg_attendance: number;
    at_risk_pct: number;
  }[];
  semester_trend: { semester: number; avg_sgpa: number; avg_attendance: number; pass_pct: number }[];
  heatmap: { department: string; semester: number; avg_sgpa: number; count: number }[];
  attendance_bands: { band: string; avg_sgpa: number; count: number }[];
  departments: string[];
};

type InterventionsData = {
  summary: { high_risk: number; attendance_risk: number; anomalies: number; queue: number };
  items: (Row & { drivers: Driver[]; forecast: Forecast; intervention: Intervention })[];
};

type AttendanceData = {
  total: number;
  page: number;
  size: number;
  pages: number;
  summary: { target: number; predicted_low_engagement: number; predicted_pct: number; avg_forecast: number; currently_low_engagement: number };
  items: (Row & { forecast: Forecast })[];
};

type ClusterData = { clusters: ClusterInfo[] };
type AnomalyData = StudentList;

type TabId = "overview" | "explorer" | "interventions" | "attendance" | "clusters" | "models";

const TABS: { id: TabId; label: string; icon: typeof Gauge }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "explorer", label: "Learners", icon: Users },
  { id: "interventions", label: "Interventions", icon: ShieldAlert },
  { id: "attendance", label: "Engagement risk", icon: HeartPulse },
  { id: "clusters", label: "Clusters", icon: Layers },
  { id: "models", label: "Model lab", icon: BrainCircuit },
];

function riskTone(label: string): "success" | "warn" | "danger" {
  if (label === "high") return "danger";
  if (label === "medium") return "warn";
  return "success";
}

function riskText(label: string): string {
  if (label === "high") return "text-red-600";
  if (label === "medium") return "text-amber-600";
  return "text-emerald-600";
}

function riskBar(label: string): string {
  if (label === "high") return "bg-danger";
  if (label === "medium") return "bg-warn";
  return "bg-success";
}

function priorityTone(priority: string): "danger" | "warn" | "neutral" | "success" {
  if (priority === "critical" || priority === "high") return "danger";
  if (priority === "medium") return "warn";
  if (priority === "low") return "success";
  return "neutral";
}

function shortDept(dept: string) {
  const moduleCode = dept.replace(/^OULAD Module\s+/i, "");
  if (moduleCode !== dept) return moduleCode;
  return dept
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 4);
}

export default function PerformancePage() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [modelState, setModelState] = useState<ModelState | null>(null);
  const [cohorts, setCohorts] = useState<Cohorts | null>(null);
  const [clusterData, setClusterData] = useState<ClusterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [ownRecord, setOwnRecord] = useState<Detail | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");

  const loadOverview = useCallback(async () => {
    const model = await api<{ state: ModelState; metrics: Metrics | null }>("/api/performance/model");
    setMetrics(model.metrics);
    setModelState(model.state);
    if (!isStudent) {
      const [sum, cohort, clusters] = await Promise.allSettled([
        api<Summary>("/api/performance/summary"),
        api<Cohorts>("/api/performance/cohorts"),
        api<ClusterData>("/api/performance/clusters"),
      ]);
      if (sum.status === "fulfilled") setSummary(sum.value);
      if (cohort.status === "fulfilled") setCohorts(cohort.value);
      if (clusters.status === "fulfilled") setClusterData(clusters.value.clusters);
      const failed = [sum, cohort, clusters].find((result) => result.status === "rejected");
      if (failed && failed.status === "rejected") {
        setError(failed.reason instanceof Error ? failed.reason.message : "Cohort analytics unavailable");
      }
    }
  }, [isStudent]);

  useEffect(() => {
    if (!user) return;
    loadOverview()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load performance analytics"))
      .finally(() => setLoading(false));
  }, [user, loadOverview]);

  useEffect(() => {
    if (!isStudent) return;
    setLoading(false);
    if (!user?.roll_no) return;
    api<Detail>(`/api/performance/students/${encodeURIComponent(user.roll_no)}`)
      .then(setOwnRecord)
      .catch((err) => setError(err instanceof Error ? err.message : "No performance record found"));
  }, [isStudent, user?.roll_no]);

  async function retrain() {
    setRetraining(true);
    try {
      await api("/api/performance/retrain", { method: "POST" });
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const snap = await api<{ state: ModelState; metrics: Metrics | null }>("/api/performance/model");
        setModelState(snap.state);
        setMetrics(snap.metrics);
        if (snap.state.status === "ready" && snap.metrics && snap.metrics.trained_at !== metrics?.trained_at) break;
        if (snap.state.status === "error") throw new Error(snap.state.error || "Retraining failed");
      }
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retraining failed");
    } finally {
      setRetraining(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await loadOverview();
      if (isStudent && user?.roll_no) {
        const record = await api<Detail>(`/api/performance/students/${encodeURIComponent(user.roll_no)}`);
        setOwnRecord(record);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !isStudent) {
    return (
      <div className="flex items-center gap-3 py-24 text-[13px] text-slate-500">
        <Spinner /> Loading real OULAD cohort…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="MODULE 06 · PERFORMANCETRACKER"
        title="Student Performance Intelligence"
        description={
          isStudent
            ? "Your digital twin: real academic record, engagement forecast, skill gaps, career fit and a scenario simulator."
            : "Models trained and evaluated on 32,593 anonymised Open University (OULAD) learner records — risk, engagement, clustering, outliers and interventions."
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {user?.role === "admin" && (
              <Button size="sm" onClick={retrain} loading={retraining}>
                <BrainCircuit className="h-3.5 w-3.5" /> {retraining ? "Training…" : "Retrain models"}
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          <button className="ml-auto text-red-500" onClick={() => setError("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isStudent ? (
        user?.roll_no ? (
          ownRecord ? (
            <StudentWorkspace record={ownRecord} />
          ) : (
            <Card>
              <EmptyState
                icon={<Database className="h-8 w-8" />}
                title="No record linked"
                description="Your academic record is not in the tracker yet. Contact the examination cell."
              />
            </Card>
          )
        ) : (
          <Card>
            <EmptyState
              icon={<GraduationCap className="h-8 w-8" />}
              title="Roll number missing"
              description="Your profile has no roll number linked, so the tracker cannot find your record."
            />
          </Card>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1 rounded-[10px] border border-line bg-white p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition",
                  tab === t.id ? "bg-brand/5 text-brand" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === "interventions" && summary?.at_risk ? (
                  <span className="rounded bg-danger/10 px-1 text-[10px] font-bold text-red-600">
                    {summary.at_risk > 999 ? `${Math.round(summary.at_risk / 1000)}k` : summary.at_risk}
                  </span>
                ) : null}
              </button>
            ))}
            {metrics && (
              <span className="ml-auto hidden items-center gap-2 pr-2 text-[10.5px] text-slate-400 lg:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {metrics.best} · AUC {metrics.models.find((m) => m.name === metrics.best)?.roc_auc.toFixed(3)} ·{" "}
                {metrics.n_rows.toLocaleString("en-IN")} rows
              </span>
            )}
          </div>

          {tab === "overview" && (
            <OverviewTab
              summary={summary}
              cohorts={cohorts}
              metrics={metrics}
              clusters={clusterData.length ? clusterData : metrics?.clusters ?? []}
              modelState={modelState}
            />
          )}
          {tab === "explorer" && <ExplorerTab departments={cohorts?.departments ?? []} clusterOptions={clusterData} />}
          {tab === "interventions" && <InterventionsTab />}
          {tab === "attendance" && <AttendanceTab departments={cohorts?.departments ?? []} />}
          {tab === "clusters" && <ClustersTab clusters={clusterData.length ? clusterData : metrics?.clusters ?? []} />}
          {tab === "models" && <ModelsTab metrics={metrics} state={modelState} />}
        </>
      )}
    </div>
  );
}

/* ----------------------------------- Overview ---------------------------------- */

function OverviewTab({
  summary,
  cohorts,
  metrics,
  clusters,
  modelState,
}: {
  summary: Summary | null;
  cohorts: Cohorts | null;
  metrics: Metrics | null;
  clusters: ClusterInfo[];
  modelState: ModelState | null;
}) {
  return (
    <div className="space-y-4">
      <DataSourceBanner source={summary?.source ?? metrics?.data_source} records={summary?.records ?? metrics?.n_rows ?? 0} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Learners indexed"
          value={(summary?.records ?? 0).toLocaleString("en-IN")}
          hint={`${summary?.departments ?? 0} OULAD modules · real cohort`}
          icon={<Database className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="High risk"
          value={(summary?.at_risk ?? 0).toLocaleString("en-IN")}
          hint={`${summary?.at_risk_pct ?? 0}% need intervention`}
          tone="danger"
          icon={<AlertTriangle className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Watchlist"
          value={(summary?.watch ?? 0).toLocaleString("en-IN")}
          hint={`${summary?.watch_pct ?? 0}% in medium band`}
          tone="warn"
          icon={<Gauge className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Low engagement"
          value={(summary?.attendance_risk ?? 0).toLocaleString("en-IN")}
          hint={`${summary?.attendance_risk_pct ?? 0}% forecast below 5% active days`}
          tone="warn"
          icon={<HeartPulse className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Avg readiness"
          value={summary ? `${summary.avg_readiness}` : "—"}
          hint={`SGPA ${summary?.avg_sgpa ?? "—"} · pass ${summary?.pass_pct ?? 0}%`}
          tone="success"
          icon={<TrendingUp className="h-4.5 w-4.5" />}
        />
        <StatCard
          label="Anomalies"
          value={(summary?.anomalies ?? metrics?.anomalies.count ?? 0).toLocaleString("en-IN")}
          hint="Isolation Forest outliers"
          tone="accent"
          icon={<ShieldAlert className="h-4.5 w-4.5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <ModelSummaryCard metrics={metrics} />
        <CohortRiskCard cohorts={cohorts} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <CardTitle>Presentation trend</CardTitle>
              <p className="mt-0.5 text-[11px] text-slate-500">Average SGPA and pass rate across OULAD presentations (J = Feb, B = Oct)</p>
            </div>
            <Badge tone="brand">cohort</Badge>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cohorts?.semester_trend ?? []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="semester" tickFormatter={(v) => (Number(v) === 1 ? "J" : "B")} tick={{ fill: CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="sgpa" domain={[4, 9]} tick={{ fill: CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="pass" orientation="right" domain={[60, 100]} tick={{ fill: CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line yAxisId="sgpa" type="monotone" dataKey="avg_sgpa" stroke={BRAND} strokeWidth={2.2} dot={{ r: 2.5, fill: BRAND }} name="Avg SGPA" />
                <Line yAxisId="pass" type="monotone" dataKey="pass_pct" stroke={ACCENT} strokeWidth={1.8} strokeDasharray="4 4" dot={false} name="Pass %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <CardTitle>VLE engagement → SGPA</CardTitle>
              <p className="mt-0.5 text-[11px] text-slate-500">Final SGPA by real active-day engagement band</p>
            </div>
            <Badge tone="accent">{cohorts?.attendance_bands.length ?? 0} bands</Badge>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cohorts?.attendance_bands ?? []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="band" tick={{ fill: CHART_TICK, fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis domain={[3, 9]} tick={{ fill: CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="avg_sgpa" stroke={ACCENT} strokeWidth={2} fill="url(#bandFill)" name="Avg SGPA" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <CohortStrip clusters={clusters} />
        <DecisionRulesCard metrics={metrics} />
      </div>

      <ScenarioSimulator metrics={metrics} modelState={modelState} />
    </div>
  );
}

function DataSourceBanner({ source, records }: { source?: DataSource | null; records: number }) {
  if (!source) return null;
  const real = source.kind === "real";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface-2 px-3.5 py-2.5">
      <span className={cn("inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", real ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300")}>
        <Database className="h-3 w-3" /> {real ? "Real-world data" : "Synthetic fallback"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-slate-800">
          {source.name} · {records.toLocaleString("en-IN")} learner records
        </p>
        <p className="truncate text-[10.5px] text-slate-500">
          {source.provider} · {source.license}{source.note ? ` · ${source.note}` : ""}
        </p>
      </div>
      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] font-medium text-accent hover:underline">
          Dataset <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function ModelSummaryCard({ metrics }: { metrics: Metrics | null }) {
  const importances = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.feature_importances)
      .map(([feature, share]) => ({ feature, label: metrics.feature_names[feature] || feature, share }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 6);
  }, [metrics]);

  if (!metrics) {
    return (
      <Card>
        <EmptyState
          icon={<BrainCircuit className="h-8 w-8" />}
          title="Training the intelligence suite"
          description="Benchmarking classifiers, regressors, clustering and anomaly detection…"
        />
      </Card>
    );
  }

  const best = metrics.models.find((m) => m.name === metrics.best);
  const cm = metrics.confusion;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Model benchmark</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {metrics.n_rows.toLocaleString("en-IN")} rows · {Math.round(metrics.positive_rate * 100)}% high-risk · trained{" "}
            {timeAgo(metrics.trained_at)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="success">{metrics.best} wins</Badge>
          <Badge tone="neutral">{(metrics.total_train_ms / 1000).toFixed(1)}s</Badge>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-1.5 pr-2 font-semibold">Model</th>
              <th className="px-2 py-1.5 font-semibold">AUC</th>
              <th className="px-2 py-1.5 font-semibold">F1</th>
              <th className="px-2 py-1.5 font-semibold">Recall</th>
              <th className="px-2 py-1.5 font-semibold">Train</th>
            </tr>
          </thead>
          <tbody>
            {metrics.models.map((model) => (
              <tr key={model.name} className={cn("border-b border-line/70 last:border-0", model.name === metrics.best && "bg-brand/[0.03]")}>
                <td className="py-1.5 pr-2">
                  <span className="flex items-center gap-1.5 font-medium text-slate-800">
                    {model.name === metrics.best && <Sparkles className="h-3 w-3 text-brand" />}
                    {model.name}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-semibold text-brand">{model.roc_auc.toFixed(3)}</td>
                <td className="px-2 py-1.5 text-slate-700">{model.f1.toFixed(3)}</td>
                <td className="px-2 py-1.5 text-slate-700">{model.recall.toFixed(3)}</td>
                <td className="px-2 py-1.5 text-slate-500">{model.train_ms} ms</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 pr-2 font-medium text-slate-800">SGPA regressor</td>
              <td className="px-2 py-1.5 text-slate-700" colSpan={2}>
                R² {metrics.regression.r2.toFixed(3)}
              </td>
              <td className="px-2 py-1.5 text-slate-700" colSpan={2}>
                MAE {metrics.regression.mae}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2 font-medium text-slate-800">Engagement RF</td>
              <td className="px-2 py-1.5 text-slate-700" colSpan={2}>
                R² {metrics.attendance_model.r2.toFixed(3)}
              </td>
              <td className="px-2 py-1.5 text-slate-700" colSpan={2}>
                MAE {metrics.attendance_model.mae}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-md border border-line bg-slate-50/70 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Confusion · {metrics.best}</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1 text-center">
            <div className="rounded bg-success/10 px-1 py-1.5">
              <p className="text-[13px] font-semibold text-emerald-700">{cm.tn.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-slate-500">TN</p>
            </div>
            <div className="rounded bg-warn/10 px-1 py-1.5">
              <p className="text-[13px] font-semibold text-amber-700">{cm.fp.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-slate-500">FP</p>
            </div>
            <div className="rounded bg-danger/10 px-1 py-1.5">
              <p className="text-[13px] font-semibold text-red-700">{cm.fn.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-slate-500">FN</p>
            </div>
            <div className="rounded bg-brand/10 px-1 py-1.5">
              <p className="text-[13px] font-semibold text-brand">{cm.tp.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-slate-500">TP</p>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-line bg-slate-50/70 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top feature importance</p>
          <div className="mt-1.5 space-y-1.5">
            {importances.map((item) => (
              <div key={item.feature}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="truncate text-slate-600">{item.label}</span>
                  <span className="text-slate-400">{(item.share * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-200/70">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(3, item.share * 100 * 2.4)}%` }} />
                </div>
              </div>
            ))}
          </div>
          {best && (
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              Best AUC {best.roc_auc.toFixed(3)} · {best.train_ms} ms train · tiers high ≥ {metrics.tiers.high}, medium ≥ {metrics.tiers.medium}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function CohortRiskCard({ cohorts }: { cohorts: Cohorts | null }) {
  if (!cohorts) {
    return (
      <Card>
        <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="Loading cohort analytics" description="Aggregating 32,593 real OULAD records by module." />
      </Card>
    );
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <CardTitle>Risk by department</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Sorted by high-risk share</p>
        </div>
        <Badge tone="danger">{cohorts.risk_by_dept[0]?.at_risk_pct ?? 0}% peak</Badge>
      </div>
      <div className="space-y-2.5">
        {cohorts.risk_by_dept.map((dept) => (
          <div key={dept.department}>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="truncate pr-2 text-slate-600" title={dept.department}>
                {dept.department}
              </span>
              <span className="shrink-0 text-slate-500">
                {dept.at_risk_pct}% · SGPA {dept.avg_sgpa}
              </span>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="bg-emerald-400" style={{ width: `${(dept.low / dept.total) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(dept.medium / dept.total) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(dept.high / dept.total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> low</span>
        <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-400" /> medium</span>
        <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-red-500" /> high</span>
        <span className="ml-auto">{cohorts.risk_by_dept.reduce((sum, d) => sum + d.total, 0).toLocaleString("en-IN")} records</span>
      </div>
    </Card>
  );
}

function CohortStrip({ clusters }: { clusters: ClusterInfo[] }) {
  if (!clusters.length) {
    return (
      <Card>
        <EmptyState icon={<Layers className="h-7 w-7" />} title="Clusters warming up" description="K-Means segmentation runs during model training." />
      </Card>
    );
  }
  const tones = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-orange-500", "bg-red-500"];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>K-Means cohort clusters</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Five behavioural segments ordered by readiness</p>
        </div>
        <Badge tone="brand">K = 5</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {clusters.map((cluster, i) => (
          <div key={cluster.label} className="rounded-md border border-line bg-slate-50/60 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", tones[i % tones.length])} />
              <p className="truncate text-[10.5px] font-semibold text-slate-800" title={cluster.label}>
                {cluster.label}
              </p>
            </div>
            <p className="mt-1 text-[16px] font-semibold tracking-tight text-slate-900">{cluster.count.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-slate-500">SGPA {cluster.avg_sgpa} · ready {cluster.avg_readiness}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-400">{cluster.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DecisionRulesCard({ metrics }: { metrics: Metrics | null }) {
  const rules = metrics?.decision_rules ?? [];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Explainable decision rules</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Interpretable Decision Tree paths with the highest risk purity</p>
        </div>
        <Badge tone="neutral">{rules.length} rules</Badge>
      </div>
      <div className="mt-2.5 space-y-2">
        {rules.slice(0, 4).map((rule, i) => (
          <div key={i} className="rounded-md border border-line bg-slate-50/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rule {i + 1}</p>
              <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                {rule.high_risk_pct}% high risk
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-700">
              {rule.conditions.map((c, j) => (
                <span key={j}>
                  {j > 0 && <span className="text-slate-400"> and </span>}
                  {c}
                </span>
              ))}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">{rule.samples.toLocaleString("en-IN")} training samples</p>
          </div>
        ))}
        {!rules.length && <p className="text-[11.5px] text-slate-500">Rules appear once the Decision Tree finishes training.</p>}
      </div>
    </Card>
  );
}

/* ------------------------------- Scenario simulator ------------------------------ */

const SLIDER_FIELDS = [
  { key: "attendance_pct", label: "VLE engagement", min: 0, max: 100, step: 1, unit: "%" },
  { key: "assignment_avg", label: "Assignment avg", min: 0, max: 10, step: 0.1, unit: "/10" },
  { key: "internal_avg", label: "Internal marks", min: 0, max: 100, step: 1, unit: "%" },
  { key: "ai_flag_rate", label: "AI-flagged submissions", min: 0, max: 60, step: 1, unit: "%" },
  { key: "prev_backlogs", label: "Previous attempts", min: 0, max: 6, step: 1, unit: "" },
  { key: "prev_sgpa", label: "Early score /10", min: 0, max: 10, step: 0.1, unit: "" },
  { key: "semester", label: "Presentation", min: 1, max: 2, step: 1, unit: "" },
] as const;

type SliderKey = (typeof SLIDER_FIELDS)[number]["key"];
type SimForm = Record<SliderKey, number>;

function scenarioDefaults(metrics: Metrics | null): SimForm {
  const stats = metrics?.stats ?? {};
  const mean = (key: string, fallback: number) => Math.round((stats[key]?.mean ?? fallback) * 10) / 10;
  return {
    attendance_pct: Math.round(mean("attendance_pct", 26)),
    assignment_avg: mean("assignment_avg", 5.7),
    internal_avg: Math.round(mean("internal_avg", 57)),
    ai_flag_rate: Math.round(mean("ai_flag_rate", 0)),
    prev_backlogs: Math.round(mean("prev_backlogs", 0.3)),
    prev_sgpa: mean("prev_sgpa", 5.6),
    semester: 1,
  };
}

function ScenarioSimulator({ metrics, modelState }: { metrics: Metrics | null; modelState: ModelState | null }) {
  const [form, setForm] = useState<SimForm>(() => scenarioDefaults(metrics));
  const [result, setResult] = useState<{ risk_score: number; risk_label: string; predicted_sgpa: number; basis: string } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (metrics) setForm(scenarioDefaults(metrics));
  }, [metrics]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setRunning(true);
      api<{ risk_score: number; risk_label: string; predicted_sgpa: number; basis: string }>("/api/performance/what-if", {
        method: "POST",
        json: form,
      })
        .then(setResult)
        .catch(() => undefined)
        .finally(() => setRunning(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [form]);

  if (!metrics) {
    return (
      <Card>
        <EmptyState
          icon={<SlidersHorizontal className="h-7 w-7" />}
          title="Simulator waiting for the model"
          description={modelState?.status === "training" ? "Training in progress — this panel activates automatically." : "No trained artifact yet."}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Academic scenario simulator</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Move the levers to see the trained model&apos;s risk and SGPA forecast for a hypothetical student.</p>
        </div>
        <Badge tone="brand">{result?.basis.replace("model:", "model · ") ?? "scoring"}</Badge>
      </div>

      <div className="mt-3 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {SLIDER_FIELDS.map((field) => (
            <div key={field.key}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{field.label}</span>
                <span className="font-semibold text-slate-800">
                  {form[field.key]}
                  {field.unit}
                </span>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={form[field.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
                className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand"
              />
            </div>
          ))}
        </div>

        <div className="rounded-md border border-line bg-slate-50/70 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Predicted risk</p>              <p className={cn("mt-1 text-[28px] font-semibold leading-none tracking-tight", result ? riskText(result.risk_label) : "text-slate-900")}>
                {result ? `${(result.risk_score * 100).toFixed(1)}%` : "—"}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">{running ? "scoring…" : result ? `${result.risk_label} band` : ""}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Forecast SGPA</p>
              <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
                {result ? result.predicted_sgpa.toFixed(2) : "—"}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">next semester</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn("h-full rounded-full transition-all", result ? riskBar(result.risk_label) : "bg-brand")}
              style={{ width: `${result ? Math.max(3, result.risk_score * 100) : 0}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>low</span>
            <span>medium ≥ {(metrics.tiers.medium * 100).toFixed(0)}%</span>
            <span>high ≥ {(metrics.tiers.high * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[10px] text-slate-400">Trained on {metrics.n_rows.toLocaleString("en-IN")} records</p>
            <button className="text-[10px] font-semibold text-brand hover:text-brand-strong" onClick={() => setForm(scenarioDefaults(metrics))}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------- Explorer ----------------------------------- */

function ExplorerTab({ departments, clusterOptions }: { departments: string[]; clusterOptions: ClusterInfo[] }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [risk, setRisk] = useState("");
  const [cluster, setCluster] = useState("");
  const [anomaly, setAnomaly] = useState("");
  const [sort, setSort] = useState("risk");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StudentList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [query, department, semester, risk, cluster, anomaly, sort, direction, size]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), size: String(size), sort, direction });
    if (query) params.set("search", query);
    if (department) params.set("department", department);
    if (semester) params.set("semester", semester);
    if (risk) params.set("risk", risk);
    if (cluster) params.set("cluster", cluster);
    if (anomaly) params.set("anomaly", anomaly);

    setLoading(true);
    api<StudentList>(`/api/performance/students?${params.toString()}`)
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not query the cohort"))
      .finally(() => setLoading(false));
  }, [page, size, sort, direction, query, department, semester, risk, cluster, anomaly]);

  return (
    <>
      <Card className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <CardTitle>Student explorer</CardTitle>
            <p className="mt-0.5 text-[11px] text-slate-500">Server-side search across {(data?.total ?? 0).toLocaleString("en-IN")} matching records</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
            <Users className="h-3 w-3" /> {data?.total.toLocaleString("en-IN") ?? "—"} results
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-line bg-slate-50/40 px-4 py-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or roll number" className="h-8 pl-8 text-[12px]" />
          </div>
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-8 w-auto min-w-[140px] text-[11.5px]">
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </Select>
          <Select value={semester} onChange={(e) => setSemester(e.target.value)} className="h-8 w-auto text-[11.5px]">
            <option value="">Semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>Sem {sem}</option>
            ))}
          </Select>
          <Select value={risk} onChange={(e) => setRisk(e.target.value)} className="h-8 w-auto text-[11.5px]">
            <option value="">All risk</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={cluster} onChange={(e) => setCluster(e.target.value)} className="h-8 w-auto max-w-[160px] text-[11.5px]">
            <option value="">All clusters</option>
            {clusterOptions.map((c) => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </Select>
          <Select value={anomaly} onChange={(e) => setAnomaly(e.target.value)} className="h-8 w-auto text-[11.5px]">
            <option value="">All patterns</option>
            <option value="1">Anomalies only</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 w-auto text-[11.5px]">
            <option value="risk">Risk score</option>
            <option value="sgpa">Final SGPA</option>
            <option value="attendance">VLE engagement</option>
            <option value="forecast">Engagement forecast</option>
            <option value="assignment">Assignment avg</option>
            <option value="readiness">Placement readiness</option>
            <option value="name">Name</option>
            <option value="roll">Roll number</option>
          </Select>
          <button
            onClick={() => setDirection((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex h-8 items-center gap-1 rounded-md border border-line-strong bg-white px-2.5 text-[11.5px] text-slate-600 transition hover:border-slate-400"
          >
            {direction === "desc" ? <ArrowDownWideNarrow className="h-3 w-3" /> : <ArrowUpNarrowWide className="h-3 w-3" />}
            {direction === "desc" ? "Desc" : "Asc"}
          </button>
          <Select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-8 w-auto text-[11.5px]">
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </Select>
        </div>

        {error && <p className="px-4 py-2 text-[11.5px] text-red-600">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 font-semibold">Student</th>
                <th className="px-3 py-2 font-semibold">Module · Pres</th>
                <th className="px-3 py-2 font-semibold">VLE engagement</th>
                <th className="px-3 py-2 font-semibold">Forecast</th>
                <th className="px-3 py-2 font-semibold">SGPA</th>
                <th className="px-3 py-2 font-semibold">Readiness</th>
                <th className="px-3 py-2 font-semibold">Cluster</th>
                <th className="px-3 py-2 font-semibold">Risk</th>
                <th className="px-4 py-2 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    <Spinner /> Querying indexed records…
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10">
                    <EmptyState icon={<Search className="h-7 w-7" />} title="No matching learners" description="Try clearing filters or searching a different roll number." />
                  </td>
                </tr>
              )}
              {data?.items.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row.roll_no)}
                  className="cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-brand/[0.02]"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-slate-800">{row.name}</p>
                      {row.anomaly_flag && (
                        <span title="Isolation Forest outlier">
                          <ShieldAlert className="h-3 w-3 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">{row.roll_no}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-[11px] text-slate-700" title={row.department}>{shortDept(row.department)}</p>
                    <p className="text-[10px] text-slate-400">Sem {row.semester}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("font-medium", row.attendance_pct < 5 ? "text-amber-600" : "text-slate-700")}>{row.attendance_pct}%</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("font-medium", row.attendance_next < 5 ? "text-red-600" : "text-emerald-600")}>
                      {row.attendance_next.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.final_sgpa.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-10 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, row.placement_readiness)}%` }} />
                      </div>
                      <span className="text-[10.5px] text-slate-600">{row.placement_readiness.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{row.cluster_label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={riskTone(row.risk_label)}>{row.risk_label}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", riskBar(row.risk_label))} style={{ width: `${Math.max(4, row.risk_score * 100)}%` }} />
                      </div>
                      <span className={cn("w-8 text-right text-[11px] font-semibold", riskText(row.risk_label))}>{Math.round(row.risk_score * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11px] text-slate-500">
          <span>
            Page {data?.page ?? 1} of {data?.pages ?? 1}
            {loading && data && <span className="ml-2 text-brand">updating…</span>}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" disabled={!data || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={!data || page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {selected && <DigitalTwinDrawer rollNo={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

/* --------------------------------- Interventions -------------------------------- */

function InterventionsTab() {
  const [data, setData] = useState<InterventionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api<InterventionsData>("/api/performance/interventions?limit=30")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the intervention queue"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-[12.5px] text-slate-500">
        <Spinner /> Building the intervention queue…
      </div>
    );
  }
  if (error) {
    return <Card><EmptyState icon={<AlertTriangle className="h-7 w-7" />} title="Queue unavailable" description={error} /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="High-risk learners" value={(data?.summary.high_risk ?? 0).toLocaleString("en-IN")} hint="risk ≥ 60%" tone="danger" icon={<AlertTriangle className="h-4.5 w-4.5" />} />
        <StatCard label="Engagement risk" value={(data?.summary.attendance_risk ?? 0).toLocaleString("en-IN")} hint="forecast below 5% active days" tone="warn" icon={<HeartPulse className="h-4.5 w-4.5" />} />
        <StatCard label="Anomalies" value={(data?.summary.anomalies ?? 0).toLocaleString("en-IN")} hint="Isolation Forest flags" tone="accent" icon={<ShieldAlert className="h-4.5 w-4.5" />} />
        <StatCard label="Priority queue" value={data?.summary.queue ?? 0} hint="highest risk first" tone="brand" icon={<Target className="h-4.5 w-4.5" />} />
      </div>

      <Card className="!p-0">
        <div className="border-b border-line px-4 py-3">
          <CardTitle>Faculty intervention queue</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Top risk learners with explainable drivers, engagement forecast and recommended owner.</p>
        </div>
        <div className="divide-y divide-line">
          {(data?.items ?? []).map((item) => (
            <div key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3 transition hover:bg-slate-50/70">
              <button
                onClick={() => setSelected(item.roll_no)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/10 text-[10.5px] font-bold text-brand"
                title="Open digital twin"
              >
                {item.risk_score >= 0.8 ? "!!" : "!"}
              </button>
              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button className="text-[12.5px] font-semibold text-slate-800 hover:text-brand" onClick={() => setSelected(item.roll_no)}>
                    {item.name}
                  </button>
                  <span className="text-[10px] text-slate-400">{item.roll_no}</span>
                  <Badge tone={riskTone(item.risk_label)}>{Math.round(item.risk_score * 100)}% risk</Badge>
                  <Badge tone={priorityTone(item.intervention.priority)}>{item.intervention.priority}</Badge>
                </div>
                <p className="mt-0.5 text-[10.5px] text-slate-500">
                  {shortDept(item.department)} · Pres {item.semester} · engagement {item.attendance_pct}% → forecast {item.forecast.expected}% · SGPA {item.final_sgpa.toFixed(2)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {item.drivers.slice(0, 2).map((d) => (
                    <span key={d.feature} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {d.label} {d.z > 0 ? "+" : ""}{d.z}σ
                    </span>
                  ))}
                  {item.anomaly_flag && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">anomaly</span>
                  )}
                </div>
              </div>
              <div className="min-w-[190px] text-right">
                <p className="text-[11px] font-semibold text-slate-700">{item.intervention.action}</p>
                <p className="text-[10px] text-slate-400">Owner · {item.intervention.owner}</p>
              </div>
            </div>
          ))}
          {(data?.items ?? []).length === 0 && <p className="px-4 py-10 text-center text-[12px] text-slate-500">The intervention queue is empty.</p>}
        </div>
      </Card>

      {selected && <DigitalTwinDrawer rollNo={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* -------------------------------- Attendance risk -------------------------------- */

function AttendanceTab({ departments }: { departments: string[] }) {
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [department, semester]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), size: "25" });
    if (department) params.set("department", department);
    if (semester) params.set("semester", semester);
    setLoading(true);
    api<AttendanceData>(`/api/performance/attendance-risk?${params.toString()}`)
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [page, department, semester]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Forecast below target" value={(data?.summary.predicted_low_engagement ?? 0).toLocaleString("en-IN")} hint={`${data?.summary.predicted_pct ?? 0}% of the cohort forecast under ${data?.summary.target ?? 5}%`} tone="danger" icon={<HeartPulse className="h-4.5 w-4.5" />} />
        <StatCard label="Currently low engagement" value={(data?.summary.currently_low_engagement ?? 0).toLocaleString("en-IN")} hint="early-session active days" tone="warn" icon={<AlertTriangle className="h-4.5 w-4.5" />} />
        <StatCard label="Avg engagement forecast" value={data ? `${data.summary.avg_forecast}%` : "—"} hint="Engagement Random Forest" tone="accent" icon={<TrendingUp className="h-4.5 w-4.5" />} />
        <StatCard label="Watchlist target" value={`${data?.summary.target ?? 5}%`} hint="active VLE days per week" tone="success" icon={<Target className="h-4.5 w-4.5" />} />
      </div>

      <Card className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <CardTitle>Low-engagement worklist</CardTitle>
            <p className="mt-0.5 text-[11px] text-slate-500">Learners forecast under the {data?.summary.target ?? 5}% active-day line, with the lift needed to recover.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-8 w-auto min-w-[140px] text-[11.5px]">
              <option value="">All modules</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </Select>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)} className="h-8 w-auto text-[11.5px]">
              <option value="">Presentation</option>
              {[1, 2].map((sem) => (
                <option key={sem} value={sem}>{sem === 1 ? "J (Feb)" : "B (Oct)"}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 font-semibold">Student</th>
                <th className="px-3 py-2 font-semibold">Module · Pres</th>
                <th className="px-3 py-2 font-semibold">Current</th>
                <th className="px-3 py-2 font-semibold">Forecast</th>
                <th className="px-3 py-2 font-semibold">Delta</th>
                <th className="px-3 py-2 font-semibold">To target</th>
                <th className="px-4 py-2 font-semibold">Risk</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    <Spinner /> Forecasting VLE engagement…
                  </td>
                </tr>
              )}
              {data?.items.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row.roll_no)} className="cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-brand/[0.02]">
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-800">{row.name}</p>
                    <p className="text-[10px] text-slate-400">{row.roll_no}</p>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-600">{shortDept(row.department)} · {row.semester === 1 ? "J" : "B"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.attendance_pct.toFixed(1)}%</td>
                  <td className="px-3 py-2 font-semibold text-red-600">{row.forecast.expected}%</td>
                  <td className={cn("px-3 py-2", row.forecast.delta < 0 ? "text-red-600" : "text-emerald-600")}>
                    {row.forecast.delta > 0 ? "+" : ""}{row.forecast.delta}%
                  </td>
                  <td className="px-3 py-2">
                    {row.forecast.below_target ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        +{row.forecast.recovery_days} pts
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        on target
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={riskTone(row.risk_label)}>{row.risk_label}</Badge>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[12px] text-slate-500">No learners forecast below the engagement target for this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-slate-500">
          <span>Page {data?.page ?? 1} of {data?.pages ?? 1}</span>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" disabled={!data || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={!data || page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {selected && <DigitalTwinDrawer rollNo={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ------------------------------------ Clusters ----------------------------------- */

function ClustersTab({ clusters }: { clusters: ClusterInfo[] }) {
  if (!clusters.length) {
    return <Card><EmptyState icon={<Layers className="h-7 w-7" />} title="No cluster data" description="Clusters are produced during model training." /></Card>;
  }
  const total = clusters.reduce((sum, c) => sum + c.count, 0);
  const tones = [SUCCESS, ACCENT, WARN, "#f97316", DANGER];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clusters.map((c, i) => (
          <Card key={c.label} className="!p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tones[i % tones.length] }} />
                  <CardTitle>{c.label}</CardTitle>
                </div>
                <p className="mt-1 text-[10.5px] leading-snug text-slate-500">{c.description}</p>
              </div>
              <Badge tone="neutral">{total ? Math.round((100 * c.count) / total) : 0}%</Badge>
            </div>
            <p className="mt-3 text-[24px] font-semibold leading-none tracking-tight text-slate-900">{c.count.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-slate-400">learners</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="text-slate-400">Avg SGPA</p>
                <p className="font-semibold text-slate-800">{c.avg_sgpa}</p>
              </div>
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="text-slate-400">VLE engagement</p>
                <p className="font-semibold text-slate-800">{c.avg_attendance}%</p>
              </div>
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="text-slate-400">Readiness</p>
                <p className="font-semibold text-slate-800">{c.avg_readiness}</p>
              </div>
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="text-slate-400">Avg risk</p>
                <p className="font-semibold text-slate-800">{Math.round(c.avg_risk * 100)}%</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3 text-amber-500" /> {c.avg_study_hours} h/week study</span>
              <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-brand" /> risk {Math.round(c.avg_risk * 100)}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${total ? (100 * c.count) / total : 0}%`, backgroundColor: tones[i % tones.length] }} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="!p-4">
        <CardTitle>Cluster composition</CardTitle>
        <p className="mt-0.5 text-[11px] text-slate-500">Relative cohort share per behavioural segment</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={clusters} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART_TICK, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [Number(value ?? 0).toLocaleString("en-IN"), "learners"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {clusters.map((c, i) => (
                  <Cell key={c.label} fill={tones[i % tones.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <AnomaliesPanel />
    </div>
  );
}

function AnomaliesPanel() {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AnomalyData>("/api/performance/anomalies?size=8")
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="!p-0">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <CardTitle>Anomaly watch</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Isolation Forest outliers — unusual VLE engagement or performance combinations.</p>
        </div>
        <Badge tone="warn">{data?.total.toLocaleString("en-IN") ?? "—"} flagged</Badge>
      </div>
      <div className="divide-y divide-line">
        {loading && <p className="px-4 py-4 text-[11.5px] text-slate-500"><Spinner /> Scoring anomalies…</p>}
        {(data?.items ?? []).map((row) => (
          <button
            key={row.id}
            onClick={() => setSelected(row.roll_no)}
            className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50/70"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[12px] font-medium text-slate-800">{row.name}</span>
            <span className="text-[10px] text-slate-400">{row.roll_no}</span>
            <span className="text-[10.5px] text-slate-500">
              {shortDept(row.department)} · eng {row.attendance_pct}% · SGPA {row.final_sgpa.toFixed(2)}
            </span>
            <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              score {row.anomaly_score.toFixed(2)}
            </span>
          </button>
        ))}
        {(data?.items ?? []).length === 0 && !loading && <p className="px-4 py-4 text-[11.5px] text-slate-500">No anomalies in this cohort.</p>}
      </div>
      {selected && <DigitalTwinDrawer rollNo={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
}

/* ------------------------------------ Models ------------------------------------- */

function ModelsTab({ metrics, state }: { metrics: Metrics | null; state: ModelState | null }) {
  if (!metrics) {
    return (
      <Card>
        <EmptyState
          icon={<BrainCircuit className="h-8 w-8" />}
          title="Benchmark in progress"
          description="Preparing the OULAD cohort and training six classifiers, four regressors, clustering and anomaly detection…"
        />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Classifier benchmark · academic risk</CardTitle>
            <p className="mt-0.5 text-[11px] text-slate-500">{metrics.n_rows.toLocaleString("en-IN")} rows · trained {timeAgo(metrics.trained_at)} · {(metrics.total_train_ms / 1000).toFixed(1)}s total</p>
          </div>
          <Badge tone="success">{metrics.best} selected</Badge>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-semibold">Model</th>
                <th className="px-2 py-2 font-semibold">Accuracy</th>
                <th className="px-2 py-2 font-semibold">Precision</th>
                <th className="px-2 py-2 font-semibold">Recall</th>
                <th className="px-2 py-2 font-semibold">F1</th>
                <th className="px-2 py-2 font-semibold">ROC AUC</th>
                <th className="px-2 py-2 font-semibold">Train ms</th>
                <th className="px-3 py-2 font-semibold">Infer /1k</th>
              </tr>
            </thead>
            <tbody>
              {metrics.models.map((model) => (
                <tr key={model.name} className={cn("border-b border-line/70 last:border-0", model.name === metrics.best && "bg-brand/[0.03]")}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                      {model.name === metrics.best && <Sparkles className="h-3 w-3 text-brand" />}
                      {model.name}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-slate-700">{model.accuracy.toFixed(3)}</td>
                  <td className="px-2 py-2 text-slate-700">{model.precision.toFixed(3)}</td>
                  <td className="px-2 py-2 text-slate-700">{model.recall.toFixed(3)}</td>
                  <td className="px-2 py-2 text-slate-700">{model.f1.toFixed(3)}</td>
                  <td className="px-2 py-2 font-semibold text-brand">{model.roc_auc.toFixed(3)}</td>
                  <td className="px-2 py-2 text-slate-500">{model.train_ms}</td>
                  <td className="px-3 py-2 text-slate-500">{model.infer_ms_per_1k} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>SGPA regression benchmark</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Predicting expected final SGPA from the 7 core features.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-1.5 pr-2 font-semibold">Model</th>
                  <th className="px-2 py-1.5 font-semibold">R²</th>
                  <th className="px-2 py-1.5 font-semibold">MAE</th>
                  <th className="py-1.5 pl-2 font-semibold">Train ms</th>
                </tr>
              </thead>
              <tbody>
                {metrics.regressors.map((model) => (
                  <tr key={model.name} className={cn("border-b border-line/70 last:border-0", model.name === metrics.regression.name && "bg-brand/[0.03]")}>
                    <td className="py-1.5 pr-2 font-medium text-slate-800">{model.name}</td>
                    <td className="px-2 py-1.5 font-semibold text-brand">{model.r2.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-slate-700">{model.mae}</td>
                    <td className="py-1.5 pl-2 text-slate-500">{model.train_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-md border border-line bg-slate-50/70 p-2.5 text-[10.5px] text-slate-500">
            <span className="font-semibold text-slate-700">Engagement forecast</span> · {metrics.attendance_model.name} · R² {metrics.attendance_model.r2.toFixed(3)} · MAE {metrics.attendance_model.mae}
          </div>
        </Card>

        <Card>
          <CardTitle>Unsupervised intelligence</CardTitle>
          <p className="mt-0.5 text-[11px] text-slate-500">Segmentation and outlier detection run on the full cohort.</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-md border border-line bg-slate-50/70 px-3 py-2">
              <div>
                <p className="text-[11.5px] font-semibold text-slate-800">K-Means clustering</p>
                <p className="text-[10px] text-slate-500">5 behavioural segments on 9 engagement features</p>
              </div>
              <Badge tone="brand">{metrics.clusters.length} clusters</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-line bg-slate-50/70 px-3 py-2">
              <div>
                <p className="text-[11.5px] font-semibold text-slate-800">Isolation Forest</p>
                <p className="text-[10px] text-slate-500">Unusual VLE engagement / performance patterns</p>
              </div>
              <Badge tone="warn">{metrics.anomalies.count.toLocaleString("en-IN")} · {metrics.anomalies.pct}%</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-line bg-slate-50/70 px-3 py-2">
              <div>
                <p className="text-[11.5px] font-semibold text-slate-800">Decision Tree rules</p>
                <p className="text-[10px] text-slate-500">Human-readable high-risk paths for faculty</p>
              </div>
              <Badge tone="neutral">{metrics.decision_rules.length} rules</Badge>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
            {Object.entries(metrics.extended_feature_names).map(([key, label]) => (
              <span key={key} className="rounded bg-slate-100 px-1.5 py-0.5">{label}</span>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Decision rules detail</CardTitle>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {metrics.decision_rules.map((rule, i) => (
            <div key={i} className="rounded-md border border-line bg-slate-50/60 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rule {i + 1}</p>
                <Badge tone="danger">{rule.high_risk_pct}% high risk</Badge>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-700">
                {rule.conditions.map((c, j) => (
                  <span key={j}>
                    {j > 0 && <span className="text-slate-400"> and </span>}
                    {c}
                  </span>
                ))}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">{rule.samples.toLocaleString("en-IN")} samples</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------- Student twin -------------------------------- */

function StudentWorkspace({ record }: { record: Detail }) {
  return (
    <div className="space-y-4">
      <TwinHeader record={record} />
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <TwinNarrative record={record} />
        <TwinSkills record={record} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SubjectsCard subjects={record.subjects} />
        <div className="space-y-4">
          <RecommendationsCard recommendations={record.recommendations} />
          <CareerCard career={record.career} />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <DriversCard drivers={record.drivers} modelRisk={record.model_risk} modelLabel={record.model_label} modelSgpa={record.model_sgpa} basis={record.model_basis} />
        <WhatIfPanel record={record} />
      </div>
    </div>
  );
}

function TwinHeader({ record }: { record: Detail }) {
  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-brand/10 text-[13px] font-bold text-brand">
            {record.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">{record.name}</h2>
              <Badge tone={riskTone(record.risk_label)}>{record.risk_label.toUpperCase()} RISK</Badge>
              {record.anomaly.flagged && <Badge tone="warn">anomaly</Badge>}
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              {record.roll_no} · {record.department} · Presentation {record.semester === 1 ? "J" : "B"} · {record.cluster.label}
            </p>
            <p className="mt-0.5 text-[10.5px] text-slate-400">{record.cluster.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Risk</p>
            <p className={cn("text-[22px] font-semibold leading-none", riskText(record.risk_label))}>{Math.round(record.risk_score * 100)}%</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Forecast eng.</p>
            <p className={cn("text-[22px] font-semibold leading-none", record.forecast.below_target ? "text-red-600" : "text-emerald-600")}>
              {record.forecast.expected}%
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Readiness</p>
            <p className="text-[22px] font-semibold leading-none text-slate-900">{record.placement_readiness.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Improve</p>
            <p className="text-[22px] font-semibold leading-none text-brand">{record.improvement_probability}%</p>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "VLE engagement", value: `${record.attendance_pct}%` },
          { label: "Assignments", value: `${record.assignment_avg}/10` },
          { label: "Internals", value: `${record.internal_avg}%` },
          { label: "Practical", value: `${record.practical_avg}%` },
          { label: "Prev SGPA", value: record.prev_sgpa.toFixed(2) },
          { label: "Final SGPA", value: record.final_sgpa.toFixed(2) },
          { label: "Backlogs", value: record.prev_backlogs },
        ].map((item) => (
          <div key={item.label} className="rounded border border-line bg-slate-50/70 px-2.5 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="mt-0.5 text-[12.5px] font-semibold text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>
      {record.forecast.below_target && (
        <div className="mt-2.5 flex items-start gap-2 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          VLE engagement forecast is {record.forecast.expected}% —{" "}
          {`add about ${record.forecast.recovery_days} active study days of engagement to reach the ${record.forecast.target}% watchlist target.`}
        </div>
      )}
    </Card>
  );
}

function TwinNarrative({ record }: { record: Detail }) {
  const { twin } = record;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Digital twin narrative</CardTitle>
        <Badge tone="brand">{record.intervention.priority} priority</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-slate-50/70 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Next semester forecast</p>
          <p className="mt-1 text-[13px] font-semibold text-slate-900">
            SGPA {record.model_sgpa.toFixed(2)} · engagement {twin.forecast.expected}%
          </p>
          <p className={cn("text-[10px]", twin.forecast.delta < 0 ? "text-red-600" : "text-emerald-600")}>
            {twin.forecast.delta > 0 ? "+" : ""}{twin.forecast.delta} pp engagement delta
          </p>
        </div>
        <div className="rounded-md border border-line bg-slate-50/70 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Intervention</p>
          <p className="mt-1 text-[12px] font-semibold text-slate-900">{record.intervention.action}</p>
          <p className="text-[10px] text-slate-500">Owner · {record.intervention.owner}</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">How the twin scores you</p>
        <div className="space-y-1.5">
          {record.drivers.length === 0 && <p className="text-[11.5px] text-slate-500">No adverse drivers detected — you look healthy relative to the cohort.</p>}
          {record.drivers.map((d) => (
            <div key={d.feature} className="rounded border border-line bg-white px-2.5 py-1.5 text-[10.5px] text-slate-600">
              <span className="font-semibold text-slate-800">{d.label}</span> · {d.z > 0 ? "+" : ""}{d.z}σ — {d.sentence}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="neutral">model {record.model_basis.replace("model:", "")}</Badge>
        <Badge tone={riskTone(record.model_label)}>predicted {Math.round(record.model_risk * 100)}%</Badge>
        <Badge tone="accent">study {record.study_hours} h/wk</Badge>
        <Badge tone="neutral">{record.library_visits} active study days</Badge>
      </div>
    </Card>
  );
}

function Meter({ label, value, max = 100, tone = BRAND }: { label: string; value: number; max?: number; tone?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-800">{value.toFixed ? value.toFixed(0) : value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (100 * value) / max)}%`, backgroundColor: tone }} />
      </div>
    </div>
  );
}

function TwinSkills({ record }: { record: Detail }) {
  const { twin } = record;
  return (
    <Card>
      <CardTitle>Skill &amp; engagement profile</CardTitle>
      <p className="mt-0.5 text-[10.5px] text-slate-500">Signals feeding the model and the career fit.</p>
      <div className="mt-3 space-y-2.5">
        {twin.skills.coding > 0 && <Meter label="Coding skill" value={twin.skills.coding} tone={ACCENT} />}
        {twin.skills.communication > 0 && <Meter label="Communication" value={twin.skills.communication} tone="#7a5af8" />}
        <Meter label="LMS activity" value={twin.skills.lms} tone={SUCCESS} />
        <Meter label="Placement readiness" value={twin.skills.placement_readiness} tone={BRAND} />
        <Meter label="Study hours / week" value={twin.skills.study_hours} max={30} tone={WARN} />
      </div>
      {twin.skills.coding <= 0 && twin.skills.communication <= 0 && (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          OULAD does not record coding, communication, certifications or internships — those fields are omitted rather than estimated.
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded border border-line bg-slate-50/70 px-1 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Certs</p>
          <p className="text-[12px] font-semibold text-slate-800">{record.certifications || "—"}</p>
        </div>
        <div className="rounded border border-line bg-slate-50/70 px-1 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Internship</p>
          <p className="text-[12px] font-semibold text-slate-800">{record.internship_months ? `${record.internship_months} mo` : "—"}</p>
        </div>
        <div className="rounded border border-line bg-slate-50/70 px-1 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Completion</p>
          <p className="text-[12px] font-semibold text-slate-800">{record.assignment_completion}%</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Cohort avg SGPA {record.cohort.avg_sgpa?.toFixed(2) ?? "—"} · engagement {record.cohort.avg_attendance ?? "—"}%</p>
    </Card>
  );
}

function SubjectsCard({ subjects }: { subjects: SubjectRisk[] }) {
  return (
    <Card className="!p-0">
      <div className="border-b border-line px-4 py-3">
        <CardTitle>Subject-wise performance radar</CardTitle>
        <p className="mt-0.5 text-[11px] text-slate-500">Current internal standing and the model&apos;s expected mark per subject.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-line bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2 font-semibold">Subject</th>
              <th className="px-2 py-2 font-semibold">Current</th>
              <th className="px-2 py-2 font-semibold">Expected</th>
              <th className="px-2 py-2 font-semibold">Gap to 70</th>
              <th className="px-4 py-2 font-semibold">Risk</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.subject} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-1.5 text-slate-700">{s.subject}</td>
                <td className="px-2 py-1.5 text-slate-600">{s.current.toFixed(0)}</td>
                <td className="px-2 py-1.5 font-semibold text-slate-800">{s.expected.toFixed(0)}</td>
                <td className="px-2 py-1.5 text-slate-600">{s.gap_to_70 > 0 ? s.gap_to_70.toFixed(0) : "—"}</td>
                <td className="px-4 py-1.5">
                  <Badge tone={s.risk === "high" ? "danger" : s.risk === "medium" ? "warn" : "success"}>{s.risk}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RecommendationsCard({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <Card>
      <CardTitle>Personalized recommendations</CardTitle>
      <div className="mt-2.5 space-y-2">
        {recommendations.map((r, i) => (
          <div key={i} className="rounded-md border border-line bg-slate-50/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11.5px] font-semibold text-slate-800">{r.title}</p>
              <Badge tone={priorityTone(r.priority)}>{r.priority}</Badge>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{r.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CareerCard({ career }: { career: CareerFit[] }) {
  return (
    <Card>
      <CardTitle>Career intelligence</CardTitle>
      <p className="mt-0.5 text-[10.5px] text-slate-500">Role fit from skills, SGPA, certifications and internships.</p>
      <div className="mt-2.5 space-y-2">
        {career.map((c) => (
          <div key={c.role}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-700">{c.role}</span>
              <span className="font-semibold text-slate-800">{c.fit.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, c.fit)}%` }} />
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">Focus on {c.focus.replace(/_/g, " ")}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DriversCard({
  drivers,
  modelRisk,
  modelLabel,
  modelSgpa,
  basis,
}: {
  drivers: Driver[];
  modelRisk: number;
  modelLabel: string;
  modelSgpa: number;
  basis: string;
}) {
  return (
    <Card>
      <CardTitle>Explainable risk drivers</CardTitle>
      <p className="mt-0.5 text-[10.5px] text-slate-500">Z-scores weighted by model feature importance.</p>
      <div className="mt-2.5 space-y-2">
        {drivers.length === 0 && <p className="text-[11.5px] text-slate-500">No negative drivers — this record looks healthy relative to the cohort.</p>}
        {drivers.map((driver) => (
          <div key={driver.feature} className="rounded-md border border-line bg-slate-50/60 p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-800">{driver.label}</span>
              <span className="text-[10px] text-slate-500">{driver.z > 0 ? "+" : ""}{driver.z}σ</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200/70">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-danger" style={{ width: `${Math.min(100, Math.abs(driver.z) * 28)}%` }} />
            </div>
            <p className="mt-1 text-[10.5px] text-slate-600">{driver.sentence}</p>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge tone="neutral">{basis.replace("model:", "model · ")}</Badge>
        <Badge tone={riskTone(modelLabel)}>predicted {(modelRisk * 100).toFixed(1)}%</Badge>
        <Badge tone="brand">forecast SGPA {modelSgpa.toFixed(2)}</Badge>
      </div>
    </Card>
  );
}

/* ------------------------------------ Drawer ------------------------------------ */

function DigitalTwinDrawer({ rollNo, onClose }: { rollNo: string; onClose: () => void }) {
  const [record, setRecord] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRecord(null);
    setError("");
    api<Detail>(`/api/performance/students/${encodeURIComponent(rollNo)}`)
      .then(setRecord)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the student"));
  }, [rollNo]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-line bg-canvas p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">Digital twin · {rollNo}</p>
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-800" onClick={onClose}>
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        {!record && !error && (
          <div className="mt-10 flex items-center justify-center gap-2 text-[12px] text-slate-500">
            <Spinner /> Loading digital twin…
          </div>
        )}
        {record && <StudentWorkspace record={record} />}
      </aside>
    </div>
  );
}

/* ----------------------------------- What-if ------------------------------------ */

function WhatIfPanel({ record }: { record: Detail }) {
  const [form, setForm] = useState({
    attendance_pct: record.attendance_pct,
    assignment_avg: record.assignment_avg,
    internal_avg: record.internal_avg,
    prev_backlogs: record.prev_backlogs,
    prev_sgpa: record.prev_sgpa,
  });
  const [result, setResult] = useState<{ risk_score: number; risk_label: string; predicted_sgpa: number; basis: string } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setForm({
      attendance_pct: record.attendance_pct,
      assignment_avg: record.assignment_avg,
      internal_avg: record.internal_avg,
      prev_backlogs: record.prev_backlogs,
      prev_sgpa: record.prev_sgpa,
    });
  }, [record]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setRunning(true);
      api<{ risk_score: number; risk_label: string; predicted_sgpa: number; basis: string }>("/api/performance/what-if", {
        method: "POST",
        json: { ...form, semester: record.semester, ai_flag_rate: record.ai_flag_rate },
      })
        .then(setResult)
        .catch(() => undefined)
        .finally(() => setRunning(false));
    }, 220);
    return () => clearTimeout(handle);
  }, [form, record.semester, record.ai_flag_rate]);

  const delta = result ? result.risk_score - record.risk_score : 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>What-if simulator</CardTitle>
          <p className="mt-0.5 text-[10.5px] text-slate-500">Move the levers to see the model&apos;s risk and SGPA forecast.</p>
        </div>
        <SlidersHorizontal className="h-4 w-4 text-slate-400" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Predicted risk</p>
          <p className={cn("mt-0.5 text-[26px] font-semibold leading-none", result ? riskText(result.risk_label) : "text-slate-900")}>
            {result ? `${(result.risk_score * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">{running ? "scoring…" : result?.risk_label ? `${result.risk_label} band` : ""}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Forecast SGPA</p>
          <p className="mt-0.5 text-[26px] font-semibold leading-none text-slate-900">{result ? result.predicted_sgpa.toFixed(2) : "—"}</p>
          <p className={cn("mt-1 text-[10px]", delta <= 0 ? "text-emerald-600" : "text-red-600")}>
            {result ? `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)} pp vs current` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {SLIDER_FIELDS.filter((f) => f.key !== "semester" && f.key !== "ai_flag_rate").map((field) => (
          <div key={field.key}>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-600">{field.label}</span>
              <span className="font-semibold text-slate-800">
                {form[field.key as keyof typeof form]}
                {field.unit}
              </span>
            </div>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={form[field.key as keyof typeof form]}
              onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
              className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand"
            />
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <p className="text-[10px] text-slate-400">{result ? `Inference · ${result.basis}` : " "}</p>
        <button
          className="text-[10.5px] font-semibold text-brand hover:text-brand-strong"
          onClick={() =>
            setForm({
              attendance_pct: record.attendance_pct,
              assignment_avg: record.assignment_avg,
              internal_avg: record.internal_avg,
              prev_backlogs: record.prev_backlogs,
              prev_sgpa: record.prev_sgpa,
            })
          }
        >
          Reset
        </button>
      </div>
    </Card>
  );
}
