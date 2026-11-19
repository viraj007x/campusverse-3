"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Download,
  Play,
  ScanFace,
  Square,
  Trash2,
  Upload,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { API, api, formatDateTime, timeAgo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useWebcam, fileToDataUrl } from "@/lib/use-webcam";
import { Badge, Button, Card, CardTitle, EmptyState, Label, PageHeader, Select, Spinner, StatCard } from "@/components/ui";

type Course = { id: number; code: string; title: string; semester: number; faculty_name?: string | null };
type Session = {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  is_active: boolean;
  challenge: string;
  require_liveness: boolean;
  started_at: string;
  present_count: number;
};
type RosterRow = {
  student_id: number;
  name: string;
  roll_no: string | null;
  present: boolean;
  confidence: number | null;
  liveness_verified: boolean;
  marked_at: string | null;
};
type SessionDetail = Session & { roster: RosterRow[] };
type FrameFace = {
  box: { x: number; y: number; w: number; h: number; score: number };
  status: "verified" | "pending" | "unknown";
  student: { id: number; name: string; roll_no: string | null } | null;
  confidence: number;
  prompt?: string | null;
  liveness?: string;
};
type FrameResponse = {
  faces: FrameFace[];
  present_count: number;
  challenge: string;
  prompt: string;
  require_liveness: boolean;
};
type MyAttendance = {
  overall_percent: number;
  courses: { code: string; title: string; present: number; total: number; percent: number }[];
};

function CameraPanel({
  active,
  videoRef,
  onCapture,
  overlay,
  error,
  ready,
  prompt,
}: {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCapture?: () => void;
  overlay?: FrameFace[];
  error: string | null;
  ready: boolean;
  prompt?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
      <div className="relative aspect-[4/3] w-full">
        <video ref={videoRef} className="h-full w-full object-cover opacity-95" playsInline muted />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0b11] text-center">
            <CameraOff className="h-7 w-7 text-slate-400" />
            <p className="max-w-xs px-6 text-xs text-slate-500">
              {error || "Camera is off. Start a session or enrollment to activate it."}
            </p>
          </div>
        )}
        {active && !ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {overlay?.map((f, i) => (
          <div
            key={i}
            className={cn(
              "absolute rounded-lg border-2 transition-all",
              f.status === "verified"
                ? "border-emerald-400/90 shadow-[0_0_24px_-4px_rgba(52,211,153,0.5)]"
                : f.status === "pending"
                ? "border-amber-400/90"
                : "border-zinc-400/50"
            )}
            style={{ left: `${f.box.x * 100}%`, top: `${f.box.y * 100}%`, width: `${f.box.w * 100}%`, height: `${f.box.h * 100}%` }}
          >
            {(f.student || f.status === "unknown") && (
              <span
                className={cn(
                  "absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium",
                  f.status === "verified"
                    ? "bg-emerald-500/90 text-emerald-950"
                    : f.status === "pending"
                    ? "bg-amber-500/90 text-amber-950"
                    : "bg-zinc-700/90 text-slate-800"
                )}
              >
                {f.student ? `${f.student.name} · ${(f.confidence * 100).toFixed(0)}%` : "Unknown face"}
              </span>
            )}
          </div>
        ))}
        {active && prompt && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl border border-brand/30 bg-black/70 px-3 py-2 backdrop-blur">
            <p className="flex items-center gap-1.5 text-[11px] text-brand-strong">
              <ScanFace className="h-3.5 w-3.5" /> {prompt}
            </p>
          </div>
        )}
      </div>
      {active && (
        <div className="flex items-center justify-between border-t border-line bg-surface px-4 py-2">
          <span className="flex items-center gap-1.5 text-[10.5px] text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Camera live
          </span>
          {onCapture && (
            <button onClick={onCapture} className="text-[10.5px] text-brand hover:text-brand-strong">
              Capture frame
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EnrollCard({ onSaved }: { onSaved: () => void }) {
  const [active, setActive] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { videoRef, ready, error, capture } = useWebcam(active);

  const addCapture = () => {
    const shot = capture(720);
    if (shot && photos.length < 5) setPhotos((p) => [...p, shot]);
  };

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const list: string[] = [];
    for (const file of Array.from(files).slice(0, 5 - photos.length)) {
      list.push(await fileToDataUrl(file));
    }
    setPhotos((p) => [...p, ...list].slice(0, 5));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api<{ images_used: number; quality: number }>("/api/vision/enroll", {
        method: "POST",
        json: { images: photos },
      });
      setMessage(`Face profile saved from ${res.images_used} photo(s). Detection quality ${(res.quality * 100).toFixed(0)}%.`);
      setPhotos([]);
      setActive(false);
      onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle>Enroll your face</CardTitle>
        <Badge tone="brand">one-time setup</Badge>
      </div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-slate-500">
        Capture 3 photos — straight, slightly left, slightly right. Photos are converted to 128-dimension SFace embeddings;
        raw images are never stored.
      </p>

      <CameraPanel
        active={active}
        videoRef={videoRef}
        error={error}
        ready={ready}
        onCapture={addCapture}
        prompt={active ? "Face the camera and press Capture frame" : undefined}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={active ? "secondary" : "primary"} onClick={() => setActive((a) => !a)}>
          {active ? <><CameraOff className="h-3.5 w-3.5" /> Stop camera</> : <><Camera className="h-3.5 w-3.5" /> Open camera</>}
        </Button>
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3.5 text-[13px] text-slate-800 hover:border-zinc-600">
          <Upload className="h-3.5 w-3.5" /> Upload photos
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </label>
        {photos.length > 0 && (
          <Button size="sm" onClick={save} loading={saving}>
            <UserCheck className="h-3.5 w-3.5" /> Save profile ({photos.length})
          </Button>
        )}
        {photos.length > 0 && (
          <button onClick={() => setPhotos([])} className="text-[11px] text-slate-500 hover:text-rose-700 dark:text-rose-300">
            Clear
          </button>
        )}
      </div>

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="group relative overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`capture ${i + 1}`} className="aspect-square w-full object-cover" />
              <button
                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-slate-700 opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className={cn("mt-3 rounded-lg border px-3 py-2 text-[11.5px]", message.includes("saved") ? "border-success/30 bg-success/10 text-emerald-700 dark:text-emerald-300" : "border-danger/30 bg-danger/10 text-rose-700 dark:text-rose-300")}>
          {message}
        </p>
      )}
      <p className="mt-3 text-[10px] text-slate-400">
        Liveness verification happens during sessions with a head-turn challenge, preventing photo spoofing.
      </p>
    </Card>
  );
}

function StudentAttendance() {
  const [data, setData] = useState<MyAttendance | null>(null);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api<MyAttendance>("/api/vision/my-attendance").then(setData).catch(() => {});
    api<{ enrolled: boolean }>("/api/vision/enrollment").then((r) => setEnrolled(r.enrolled));
  }, [refreshKey]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <EnrollCard onSaved={() => setRefreshKey((k) => k + 1)} />
      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>My attendance</CardTitle>
            <Badge tone={enrolled ? "success" : "warn"}>{enrolled ? "face enrolled" : "enrollment pending"}</Badge>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${(data?.overall_percent ?? 0) >= 75 ? "#34d399" : "#fbbf24"} 0 ${data?.overall_percent ?? 0}%, #1e2233 ${data?.overall_percent ?? 0}% 100%)`,
              }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-lg font-semibold text-slate-900">
                {data?.overall_percent ?? 0}%
              </div>
            </div>
            <div className="text-[12.5px] text-slate-600">
              <p className="font-medium text-slate-800">Overall across courses</p>
              <p className="mt-0.5 text-slate-500">75% is required per course for exam eligibility.</p>
              <p className="mt-1 text-[11px] text-slate-400">{data?.courses.reduce((a, c) => a + c.total, 0) ?? 0} sessions recorded</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(data?.courses || []).map((c) => (
              <div key={c.code}>
                <div className="mb-1 flex items-center justify-between text-[11.5px]">
                  <span className="text-slate-700">
                    <span className="font-mono text-[10px] text-slate-500">{c.code}</span> · {c.title}
                  </span>
                  <span className={c.percent >= 75 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{c.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full", c.percent >= 75 ? "bg-emerald-400" : "bg-amber-400")}
                    style={{ width: `${c.percent}%` }}
                  />
                </div>
              </div>
            ))}
            {!data?.courses.length && <p className="text-sm text-slate-500">No attendance recorded yet.</p>}
          </div>
        </Card>
        <Card>
          <CardTitle>How walk-in attendance works</CardTitle>
          <ol className="mt-3 space-y-2.5 text-[12.5px] text-slate-600">
            {[
              "Faculty starts a session for the course; a camera window opens at the front of the class.",
              "You look at the camera — YuNet locates your face and SFace matches your embedding.",
              "A head-turn challenge confirms a live person is present, not a printed photo.",
              "Your attendance is marked once with the confidence score and liveness flag.",
            ].map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 font-mono text-[10px] text-brand">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function FacultySessions() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<number | "">("");
  const [requireLiveness, setRequireLiveness] = useState(true);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [frame, setFrame] = useState<FrameResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [enrolledCount, setEnrolledCount] = useState<number>(0);
  const { videoRef, ready, error: camError, capture } = useWebcam(!!activeSession?.is_active);
  const busyRef = useRef(false);

  const loadAll = useCallback(() => {
    api<Course[]>("/api/vision/courses").then((c) => {
      setCourses(c);
      setSelected((prev) => (prev === "" && c.length ? c[0].id : prev));
    });
    api<Session[]>("/api/vision/sessions").then((s) => {
      setSessions(s);
      const live = s.find((x) => x.is_active);
      if (live) setActiveSession(live);
    });
    api<{ id: number }[]>("/api/vision/students").then((s) => setEnrolledCount(s.length)).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const d = await api<SessionDetail>(`/api/vision/sessions/${id}`);
      setDetail(d);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    loadDetail(activeSession.id);
    const timer = setInterval(() => loadDetail(activeSession.id), 3500);
    return () => clearInterval(timer);
  }, [activeSession, loadDetail]);

  useEffect(() => {
    if (!activeSession?.is_active) return;
    const timer = setInterval(async () => {
      if (busyRef.current) return;
      const image = capture(720);
      if (!image) return;
      busyRef.current = true;
      try {
        const res = await api<FrameResponse>(`/api/vision/sessions/${activeSession.id}/frame`, {
          method: "POST",
          json: { image },
        });
        setFrame(res);
        loadDetail(activeSession.id);
      } catch {
        /* transient */
      } finally {
        busyRef.current = false;
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [activeSession, capture, loadDetail]);

  async function start() {
    if (selected === "") return;
    setStarting(true);
    setError("");
    try {
      const session = await api<Session>("/api/vision/sessions", {
        method: "POST",
        json: { course_id: selected, require_liveness: requireLiveness },
      });
      setActiveSession(session);
      setFrame(null);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setStarting(false);
    }
  }

  async function close() {
    if (!activeSession) return;
    try {
      await api(`/api/vision/sessions/${activeSession.id}/close`, { method: "POST" });
    } catch {
      /* ignore */
    }
    setActiveSession(null);
    setFrame(null);
    setDetail(null);
    loadAll();
  }

  const roster = detail?.roster || [];
  const present = roster.filter((r) => r.present).length;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label>Course</Label>
            <Select value={selected} onChange={(e) => setSelected(Number(e.target.value))} disabled={!!activeSession}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-canvas px-3.5 text-[12.5px] text-slate-700">
            <input
              type="checkbox"
              checked={requireLiveness}
              onChange={(e) => setRequireLiveness(e.target.checked)}
              disabled={!!activeSession}
              className="h-4 w-4 accent-indigo-500"
            />
            Require liveness challenge
          </label>
          {!activeSession ? (
            <Button onClick={start} loading={starting} disabled={selected === ""}>
              <Play className="h-4 w-4" /> Start session
            </Button>
          ) : (
            <Button variant="danger" onClick={close}>
              <Square className="h-3.5 w-3.5" /> End session
            </Button>
          )}
          {activeSession && (
            <a
              href={`${API}/api/vision/sessions/${activeSession.id}/export`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm text-slate-800 hover:border-zinc-600"
            >
              <Download className="h-4 w-4" /> CSV register
            </a>
          )}
        </div>
        {error && <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">{error}</p>}
        <p className="mt-3 text-[11px] text-slate-500">
          {enrolledCount === 1 ? "1 student has" : `${enrolledCount} students have`} enrolled face profiles. Only students enrolled in the selected course are matched.
        </p>
      </Card>

      {activeSession ? (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  {activeSession.course_code} · {activeSession.course_title}
                </p>
                <p className="text-[10.5px] text-slate-500">
                  Session #{activeSession.id} · started {timeAgo(activeSession.started_at)} · liveness{" "}
                  {activeSession.require_liveness ? "ON" : "OFF"}
                </p>
              </div>
              <Badge tone="success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
              </Badge>
            </div>
            <CameraPanel
              active={!!activeSession?.is_active}
              videoRef={videoRef}
              error={camError}
              ready={ready}
              overlay={frame?.faces}
              prompt={frame?.prompt || (activeSession.require_liveness ? "Look at the camera to begin the liveness check" : "Liveness disabled — face match only")}
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-line/60 bg-slate-50 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Detected</p>
                <p className="text-lg font-semibold text-slate-900">{frame?.faces.length ?? 0}</p>
              </div>
              <div className="rounded-lg border border-line/60 bg-slate-50 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Verified</p>
                <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                  {frame?.faces.filter((f) => f.status === "verified").length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-line/60 bg-slate-50 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Present</p>
                <p className="text-lg font-semibold text-slate-900">{frame?.present_count ?? present}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Live roster</CardTitle>
              <Badge tone="neutral">
                {present}/{roster.length}
              </Badge>
            </div>
            <div className="mt-3 max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
              {roster.map((r) => (
                <div
                  key={r.student_id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 transition",
                    r.present ? "border-success/25 bg-success/[0.06]" : "border-line/60 bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                        r.present ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </span>
                    <div>
                      <p className="text-[12px] text-slate-800">{r.name}</p>
                      <p className="text-[10px] text-slate-400">{r.roll_no || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {r.present ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> {r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : "marked"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <XCircle className="h-3 w-3" /> waiting
                      </span>
                    )}
                    {r.present && (
                      <p className="text-[10px] text-slate-400">{r.liveness_verified ? "liveness ✓" : "liveness off"}</p>
                    )}
                  </div>
                </div>
              ))}
              {roster.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Loading roster…</p>}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
              <Users className="h-3 w-3" /> Attendance is written only after a verified liveness challenge.
            </p>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<Camera className="h-8 w-8" />}
          title="No active attendance session"
          description="Pick a course above and start a session. The webcam window opens automatically for students standing at the desk."
        />
      )}

      <Card>
        <CardTitle>Recent sessions</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line/70 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-4 font-medium">Course</th>
                <th className="pb-2 pr-4 font-medium">Started</th>
                <th className="pb-2 pr-4 font-medium">Present</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Register</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {sessions.map((s) => (
                <tr key={s.id} className="text-slate-700">
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-[10px] text-slate-500">{s.course_code}</span> {s.course_title}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(s.started_at)}</td>
                  <td className="py-2.5 pr-4">{s.present_count}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={s.is_active ? "success" : "neutral"}>{s.is_active ? "live" : "closed"}</Badge>
                  </td>
                  <td className="py-2.5">
                    <a href={`${API}/api/vision/sessions/${s.id}/export`} className="text-brand hover:text-brand-strong">
                      CSV
                    </a>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  if (!user) return null;
  const isStudent = user.role === "student";

  return (
    <div>
      <PageHeader
        eyebrow="Module 02 · Computer Vision"
        title="VisionGuard Attendance"
        description={
          isStudent
            ? "Enroll your face once, then walk in. Every mark is backed by a live face match and a liveness challenge."
            : "Run classroom attendance with face recognition and anti-spoofing. Marked records appear in real time and export as CSV."
        }
        actions={<Badge tone="accent"><ScanFace className="h-3 w-3" /> YuNet + SFace</Badge>}
      />
      {isStudent ? <StudentAttendance /> : <FacultySessions />}
    </div>
  );
}
