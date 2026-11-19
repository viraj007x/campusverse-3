"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  GraduationCap,
  Layers,
  Radar,
  ScanFace,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { api, formatDateTime, timeAgo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Card, CardTitle, PageHeader, Spinner, StatCard } from "@/components/ui";

type Overview = {
  role: string;
  stats: Record<string, number | boolean | string>;
  attendance_by_course?: { code: string; title: string; present: number; total: number; percent: number }[];
  recent_chats?: { id: number; question: string; created_at: string; mode: string }[];
  recent_sessions?: { id: number; course: string; title: string; is_active: boolean; present: number; started_at: string }[];
  courses?: { id: number; code: string; title: string }[];
  crowd_now?: { zone: string; count: number }[];
  has_resume?: boolean;
};

const QUICK_ACTIONS = {
  student: [
    { href: "/app/copilot", icon: Bot, title: "Ask the copilot", copy: "Attendance rules, exam dates, syllabus topics" },
    { href: "/app/placement", icon: GraduationCap, title: "Score your resume", copy: "Compare against a real job description" },
    { href: "/app/attendance", icon: ScanFace, title: "Enroll your face", copy: "One-time setup for walk-in attendance" },
    { href: "/app/lost-found", icon: Boxes, title: "Lost something?", copy: "Visual matching across campus reports" },
  ],
  faculty: [
    { href: "/app/attendance", icon: ScanFace, title: "Start a session", copy: "Open a liveness-checked attendance window" },
    { href: "/app/analytics", icon: BarChart3, title: "Review analytics", copy: "Query trends and attendance rates" },
    { href: "/app/crowd", icon: Radar, title: "Check occupancy", copy: "YOLOv8 footfall across campus zones" },
    { href: "/app/copilot", icon: Bot, title: "Consult copilot", copy: "Regulations, exam manual, placement policy" },
  ],
  admin: [
    { href: "/app/analytics", icon: BarChart3, title: "Campus analytics", copy: "SAMVIT usage, attendance, footfall" },
    { href: "/app/crowd", icon: Radar, title: "Occupancy monitor", copy: "Live zone counts and history" },
    { href: "/app/attendance", icon: ScanFace, title: "Attendance sessions", copy: "Audit or start sessions for any course" },
    { href: "/app/lost-found", icon: Boxes, title: "Lost & found desk", copy: "Review open reports and visual matches" },
  ],
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function OverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Overview>("/api/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (!user) return null;

  const role = user.role;
  const actions = QUICK_ACTIONS[role];
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        eyebrow={`Graphic Era Hill University · ${role === "admin" ? "Administrator" : role === "faculty" ? "Faculty" : "Student"} workspace`}
        title={`Welcome back, ${user.name.split(" ").slice(-1)[0]}`}
        description={`${today} · ${user.department}${user.roll_no ? ` · ${user.roll_no}` : ""}`}
        actions={
          <Badge tone="success" className="h-8 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Systems operational
          </Badge>
        }
      />

      {error && (
        <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error} — make sure the API is running on port 8100.
        </div>
      )}

      {!data ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">
          <Spinner /> <span className="ml-2">Loading your workspace…</span>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {role === "student" && (
              <>
                <StatCard
                  label="Overall attendance"
                  value={`${data.stats.attendance_percent}%`}
                  hint={`${data.stats.courses} courses this semester`}
                  icon={<ScanFace className="h-4.5 w-4.5" />}
                  tone={(data.stats.attendance_percent as number) >= 75 ? "success" : "warn"}
                />
                <StatCard
                  label="Best resume fit"
                  value={`${data.stats.best_match_score}%`}
                  hint={`${data.stats.job_matches} job descriptions analysed`}
                  icon={<GraduationCap className="h-4.5 w-4.5" />}
                  tone="accent"
                />
                <StatCard
                  label="Mock interviews"
                  value={data.stats.interviews_completed as number}
                  hint={`Best score ${data.stats.best_interview_score}/100`}
                  icon={<BrainCircuit className="h-4.5 w-4.5" />}
                />
                <StatCard
                  label="Open lost reports"
                  value={data.stats.lost_found_open as number}
                  hint={`${data.stats.my_reports} reported by you`}
                  icon={<Boxes className="h-4.5 w-4.5" />}
                  tone="warn"
                />
              </>
            )}
            {role === "faculty" && (
              <>
                <StatCard
                  label="Courses"
                  value={data.stats.courses as number}
                  hint={`${data.stats.enrolled_students} enrolled students`}
                  icon={<Layers className="h-4.5 w-4.5" />}
                />
                <StatCard
                  label="Attendance sessions"
                  value={data.stats.sessions as number}
                  hint={`${data.stats.active_sessions} active right now`}
                  icon={<ScanFace className="h-4.5 w-4.5" />}
                  tone="accent"
                />
                <StatCard
                  label="Attendance rate"
                  value={`${data.stats.attendance_rate}%`}
                  hint={`${data.stats.today_records} marks today`}
                  icon={<CheckCircle2 className="h-4.5 w-4.5" />}
                  tone="success"
                />
                <StatCard
                  label="Indexed documents"
                  value={data.stats.documents_indexed as number}
                  hint="Available to the copilot"
                  icon={<Database className="h-4.5 w-4.5" />}
                />
              </>
            )}
            {role === "admin" && (
              <>
                <StatCard
                  label="Platform users"
                  value={data.stats.users as number}
                  hint={`${data.stats.students} students · ${data.stats.faculty} faculty`}
                  icon={<Users className="h-4.5 w-4.5" />}
                />
                <StatCard
                  label="SAMVIT questions"
                  value={data.stats.chats as number}
                  hint={`${data.stats.chats_today} asked today`}
                  icon={<Bot className="h-4.5 w-4.5" />}
                  tone="accent"
                />
                <StatCard
                  label="Attendance rate"
                  value={`${data.stats.attendance_rate}%`}
                  hint="Across all recorded sessions"
                  icon={<ScanFace className="h-4.5 w-4.5" />}
                  tone="success"
                />
                <StatCard
                  label="Knowledge base"
                  value={data.stats.chunks as number}
                  hint={`${data.stats.documents} documents · ${data.stats.llm_mode === "offline" || !data.stats.llm_mode ? "local engine" : data.stats.llm_mode}`}
                  icon={<Database className="h-4.5 w-4.5" />}
                />
              </>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <div className="space-y-6">
              {role === "student" && data.attendance_by_course && (
                <Card>
                  <div className="mb-4 flex items-center justify-between">
                    <CardTitle>Attendance by course</CardTitle>
                    <Link href="/app/attendance" className="text-xs text-brand hover:text-brand-strong">
                      Manage <ArrowRight className="ml-1 inline h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {data.attendance_by_course.map((c) => (
                      <div key={c.code}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-slate-700">
                            <span className="font-mono text-[11px] text-slate-500">{c.code}</span> · {c.title}
                          </span>
                          <span className={c.total === 0 ? "text-slate-400" : c.percent >= 75 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>
                            {c.total === 0 ? "No sessions yet" : `${c.present}/${c.total} · ${c.percent}%`}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${c.percent >= 75 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-amber-400"}`}
                            style={{ width: `${c.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {data.attendance_by_course.length === 0 && (
                      <p className="text-sm text-slate-500">No attendance sessions recorded yet.</p>
                    )}
                  </div>
                  <p className="mt-4 rounded-lg border border-line/60 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                    Institute policy requires 75% attendance per course. Use the copilot to check condonation rules.
                  </p>
                </Card>
              )}

              {role === "faculty" && data.recent_sessions && (
                <Card>
                  <div className="mb-4 flex items-center justify-between">
                    <CardTitle>Recent attendance sessions</CardTitle>
                    <Link href="/app/attendance" className="text-xs text-brand hover:text-brand-strong">
                      Open VisionGuard <ArrowRight className="ml-1 inline h-3 w-3" />
                    </Link>
                  </div>
                  <div className="divide-y divide-line/70">
                    {data.recent_sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm text-slate-800">
                            <span className="font-mono text-[11px] text-slate-500">{s.course}</span> · {s.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(s.started_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-600">{s.present} present</span>
                          <Badge tone={s.is_active ? "success" : "neutral"}>{s.is_active ? "Live" : "Closed"}</Badge>
                        </div>
                      </div>
                    ))}
                    {data.recent_sessions.length === 0 && (
                      <p className="py-6 text-center text-sm text-slate-500">No sessions yet. Start one from VisionGuard.</p>
                    )}
                  </div>
                </Card>
              )}

              {role === "admin" && (
                <Card>
                  <div className="mb-4 flex items-center justify-between">
                    <CardTitle>Live occupancy</CardTitle>
                    <Link href="/app/crowd" className="text-xs text-brand hover:text-brand-strong">
                      Open monitor <ArrowRight className="ml-1 inline h-3 w-3" />
                    </Link>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(data.crowd_now || []).map((z) => (
                      <div key={z.zone} className="rounded-xl border border-line/70 bg-canvas/60 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{z.zone}</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {z.count}
                          <span className="ml-1 text-[10px] font-normal text-slate-500">people</span>
                        </p>
                      </div>
                    ))}
                    {(!data.crowd_now || data.crowd_now.length === 0) && (
                      <p className="text-sm text-slate-500">No crowd samples yet.</p>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-line/70 bg-slate-50 p-3.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Lost & found</p>
                      <p className="mt-1 text-sm text-slate-800">
                        {String(data.stats.open_items)} open · {String(data.stats.matched_items)} matched
                      </p>
                    </div>
                    <div className="rounded-xl border border-line/70 bg-slate-50 p-3.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Resumes analysed</p>
                      <p className="mt-1 text-sm text-slate-800">{String(data.stats.resumes)} submissions</p>
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <CardTitle>Quick actions</CardTitle>
                  <Sparkles className="h-4 w-4 text-brand" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {actions.map((a) => (
                    <Link
                      key={a.href + a.title}
                      href={a.href}
                      className="group flex items-start gap-3 rounded-xl border border-line/70 bg-slate-50 p-3.5 transition hover:border-brand/40 hover:bg-brand/[0.06]"
                    >
                      <span className="rounded-lg bg-brand/15 p-2">
                        <a.icon className="h-4 w-4 text-brand" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800">{a.title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{a.copy}</p>
                      </div>
                      <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-brand" />
                    </Link>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/80 to-cyan-500/60 text-sm font-semibold text-slate-900">
                    {initials(user.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {role === "student" ? `${user.roll_no || "Student"} · Semester ${user.semester || 7}` : user.email}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Access level</span>
                    <Badge tone="brand">{role}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Department</span>
                    <span className="text-slate-700">{user.department}</span>
                  </div>
                  {role === "student" && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Face profile</span>
                      <Badge tone={data.stats.face_enrolled ? "success" : "warn"}>
                        {data.stats.face_enrolled ? "Enrolled" : "Not enrolled"}
                      </Badge>
                    </div>
                  )}
                  {role === "student" && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Resume on file</span>
                      <Badge tone={data.has_resume ? "success" : "neutral"}>{data.has_resume ? "Uploaded" : "None"}</Badge>
                    </div>
                  )}
                </div>
                <div className="mt-4 rounded-xl border border-line/60 bg-canvas/60 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                    <Zap className="h-3 w-3 text-amber-700 dark:text-amber-300" /> Next up
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-700">
                    End semester examinations begin <span className="text-brand">25 Nov 2026</span>. Hall tickets released 18 Nov.
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10.5px] text-slate-400">
                    <CalendarClock className="h-3 w-3" /> From the indexed academic calendar
                  </p>
                </div>
              </Card>

              {role === "student" && data.recent_chats && (
                <Card>
                  <CardTitle>Recent copilot questions</CardTitle>
                  <div className="mt-3 space-y-3">
                    {data.recent_chats.map((c) => (
                      <div key={c.id} className="rounded-lg border border-line/60 bg-slate-50 px-3 py-2.5">
                        <p className="line-clamp-2 text-[12.5px] text-slate-700">{c.question}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Clock3 className="h-3 w-3" /> {timeAgo(c.created_at)} · {c.mode === "offline" ? "local engine" : c.mode}
                        </p>
                      </div>
                    ))}
                    {data.recent_chats.length === 0 && (
                      <p className="text-sm text-slate-500">
                        No questions yet.{" "}
                        <Link href="/app/copilot" className="text-brand">
                          Ask the copilot
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {role !== "student" && (
                <Card>
                  <CardTitle>AI stack status</CardTitle>
                  <div className="mt-3 space-y-2.5 text-[12.5px]">
                    {[
                      [
                        "Language engine",
                        data.stats.llm_mode === "offline" || !data.stats.llm_mode
                          ? "local engine"
                          : String(data.stats.llm_mode),
                      ],
                      ["Vector store", "ChromaDB"],
                      ["Face models", "YuNet + SFace"],
                      ["Detection", "YOLOv8n"],
                      ["Embeddings", "CLIP ViT-B/32"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-slate-500">{k}</span>
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
