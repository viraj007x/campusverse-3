"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API, api, formatDateTime, timeAgo } from "@/lib/api";
import { Badge, Button, Card, CardTitle, EmptyState, Input, Label, PageHeader, Select, Spinner, StatCard, Textarea } from "@/components/ui";

type RubricItem = { criterion: string; max: number; description?: string };
type CriterionScore = { criterion: string; max: number; score: number; comment: string };
type Feedback = {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  criteria?: CriterionScore[];
  ai_signals?: Record<string, string | number>;
  mode?: string;
};
type Submission = {
  id: number;
  assignment_id: number;
  student_name?: string;
  roll_no?: string | null;
  filename: string;
  text?: string;
  status: string;
  suggested_score?: number | null;
  final_score?: number | null;
  plagiarism_pct?: number;
  ai_probability?: number;
  plagiarism_matches?: { student_name: string; similarity: number }[];
  feedback?: Feedback | null;
  analysis_mode?: string;
  created_at: string;
  reviewed_at?: string | null;
  approved_at?: string | null;
};
type Assignment = {
  id: number;
  title: string;
  prompt: string;
  rubric: RubricItem[];
  max_marks: number;
  due_date: string | null;
  created_at: string;
  course: { id: number; code: string; title: string };
  reference?: string;
  stats?: {
    submissions: number;
    awaiting_review: number;
    approved: number;
    avg_score: number | null;
    ai_flagged: number;
    plagiarism_flagged: number;
  };
  my_submission?: Submission | null;
};
type Detail = { assignment: Assignment; submissions?: Submission[]; enrolled?: number; my_submission?: Submission | null };
type EvalStats = {
  submissions: number;
  awaiting_review: number;
  approved: number;
  avg_score: number | null;
  plagiarism_flagged: number;
  ai_flagged: number;
  llm_mode: string;
};

const DEFAULT_RUBRIC: RubricItem[] = [
  { criterion: "Concept accuracy", max: 5, description: "Correctness of the core concepts" },
  { criterion: "Technical depth", max: 3, description: "Concrete detail, trade-offs and examples" },
  { criterion: "Clarity", max: 2, description: "Structure, terminology and readability" },
];

function integrityTone(value: number, danger = 60, warn = 35): "success" | "warn" | "danger" | "neutral" {
  if (value >= danger) return "danger";
  if (value >= warn) return "warn";
  if (value > 0) return "success";
  return "neutral";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge tone="success">Published</Badge>;
  if (status === "reviewed") return <Badge tone="brand">AI reviewed</Badge>;
  if (status === "under_review") return <Badge tone="warn">Under review</Badge>;
  return <Badge tone="neutral">Submitted</Badge>;
}

export default function GradingPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<EvalStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    const rows = await api<Assignment[]>("/api/eval/assignments");
    setAssignments(rows);
    setSelectedId((current) => current ?? rows[0]?.id ?? null);
    return rows;
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    const data = await api<Detail>(`/api/eval/assignments/${id}`);
    setDetail(data);
  }, []);

  const refresh = useCallback(
    async (id?: number | null) => {
      try {
        const rows = await loadAssignments();
        const target = id ?? selectedId ?? rows[0]?.id ?? null;
        if (target) await loadDetail(target);
        if (!isStudent) setStats(await api<EvalStats>("/api/eval/stats"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the grading workspace");
      }
    },
    [isStudent, loadAssignments, loadDetail, selectedId]
  );

  useEffect(() => {
    if (!user) return;
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function selectAssignment(id: number) {
    setSelectedId(id);
    setDetail(null);
    loadDetail(id).catch((err) => setError(err instanceof Error ? err.message : "Could not load the assignment"));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-24 text-sm text-slate-600">
        <Spinner /> Loading grading workspace…
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="MODULE 05 · EVALAI"
        title="Assignment Grader"
        description={
          isStudent
            ? "Submit assignments and review published rubric feedback. AI drafts stay hidden until your faculty publishes them."
            : "Rubric-based AI grading with peer plagiarism, AI-writing likelihood and human-in-the-loop publishing."
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => refresh()} loading={busy === "refresh"}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          <button className="ml-auto text-rose-700 dark:text-rose-300" onClick={() => setError("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isStudent ? (
        <StudentView
          assignments={assignments}
          selectedId={selectedId}
          detail={detail}
          onSelect={selectAssignment}
          onRefresh={() => refresh(selectedId)}
          setError={setError}
        />
      ) : (
        <FacultyView
          assignments={assignments}
          stats={stats}
          selectedId={selectedId}
          detail={detail}
          onSelect={selectAssignment}
          onRefresh={(id) => refresh(id ?? selectedId)}
          setError={setError}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </div>
  );
}

function FacultyView({
  assignments,
  stats,
  selectedId,
  detail,
  onSelect,
  onRefresh,
  setError,
  busy,
  setBusy,
}: {
  assignments: Assignment[];
  stats: EvalStats | null;
  selectedId: number | null;
  detail: Detail | null;
  onSelect: (id: number) => void;
  onRefresh: (id?: number) => void;
  setError: (message: string) => void;
  busy: string | null;
  setBusy: (value: string | null) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [courses, setCourses] = useState<{ id: number; code: string; title: string }[]>([]);
  const [courseId, setCourseId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState("");
  const [rubric, setRubric] = useState<RubricItem[]>(DEFAULT_RUBRIC);
  const [draft, setDraft] = useState({ criteria: [] as CriterionScore[], summary: "", strengths: [] as string[], improvements: [] as string[] });
  const [review, setReview] = useState<Submission | null>(null);

  useEffect(() => {
    api<{ id: number; code: string; title: string }[]>("/api/eval/courses")
      .then((rows) => {
        setCourses(rows);
        setCourseId((current) => current ?? rows[0]?.id ?? "");
      })
      .catch(() => setCourses([]));
  }, []);

  const rubricTotal = rubric.reduce((sum, item) => sum + (Number(item.max) || 0), 0);
  const draftTotal = draft.criteria.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  const readOnly = review?.status === "approved";

  async function createAssignment() {
    if (!courseId) return setError("Pick a course first");
    setBusy("create");
    try {
      const created = await api<Assignment>("/api/eval/assignments", {
        method: "POST",
        json: { course_id: courseId, title, prompt, reference, rubric, due_date: null },
      });
      setShowCreate(false);
      setTitle("");
      setPrompt("");
      setReference("");
      setRubric(DEFAULT_RUBRIC);
      onRefresh(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the assignment");
    } finally {
      setBusy(null);
    }
  }

  function openDraft(submission: Submission) {
    setReview(submission);
    const feedback = submission.feedback || {};
    setDraft({
      criteria: (feedback.criteria || []).map((c) => ({ ...c })),
      summary: feedback.summary || "",
      strengths: feedback.strengths || [],
      improvements: feedback.improvements || [],
    });
  }

  async function runReview(submission: Submission) {
    setBusy(`review-${submission.id}`);
    try {
      const analysed = await api<Submission>(`/api/eval/submissions/${submission.id}/review`, { method: "POST" });
      openDraft(analysed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!review) return;
    setBusy("approve");
    try {
      await api(`/api/eval/submissions/${review.id}/approve`, { method: "POST", json: draft });
      setReview(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish the grade");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Submissions" value={stats?.submissions ?? 0} hint={`${stats?.awaiting_review ?? 0} awaiting review`} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Published grades" value={stats?.approved ?? 0} hint={stats?.avg_score ? `Average ${stats.avg_score}/10` : "No grades published yet"} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Plagiarism flags" value={stats?.plagiarism_flagged ?? 0} hint="Peer similarity ≥ 35%" tone="danger" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="AI-writing flags" value={stats?.ai_flagged ?? 0} hint={`Grader: ${stats?.llm_mode === "offline" || !stats?.llm_mode ? "local rubric engine" : stats.llm_mode}`} tone="warn" icon={<Bot className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Assignments</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
            <div className="space-y-2">
              {assignments.length === 0 && <p className="text-sm text-slate-500">No assignments yet.</p>}
              {assignments.map((assignment) => {
                const active = assignment.id === selectedId;
                return (
                  <button
                    key={assignment.id}
                    onClick={() => onSelect(assignment.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      active ? "border-brand/40 bg-brand/10" : "border-line/70 bg-slate-50 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="neutral">{assignment.course.code}</Badge>
                      <span className="text-[11px] text-slate-500">{assignment.max_marks} marks</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{assignment.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {assignment.stats?.submissions === 1 ? "1 submission" : `${assignment.stats?.submissions ?? 0} submissions`} · {assignment.stats?.awaiting_review ?? 0} pending
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          {showCreate && (
            <Card className="space-y-3 p-4">
              <CardTitle>New assignment</CardTitle>
              <div>
                <Label>Course</Label>
                <Select value={courseId} onChange={(e) => setCourseId(Number(e.target.value))}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} · {course.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unit 4 review" />
              </div>
              <div>
                <Label>Prompt</Label>
                <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What should students answer?" />
              </div>
              <div>
                <Label>Reference answer</Label>
                <Textarea rows={3} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ground truth used for grading" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="mb-0">Rubric · {rubricTotal} marks</Label>
                  <button
                    className="text-[11px] text-brand hover:text-brand-strong"
                    onClick={() => setRubric((rows) => [...rows, { criterion: "", max: 1, description: "" }])}
                  >
                    + criterion
                  </button>
                </div>
                <div className="space-y-2">
                  {rubric.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_64px_auto] gap-2">
                      <Input
                        value={item.criterion}
                        placeholder="Criterion"
                        onChange={(e) => setRubric((rows) => rows.map((row, i) => (i === index ? { ...row, criterion: e.target.value } : row)))}
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={item.max}
                        onChange={(e) => setRubric((rows) => rows.map((row, i) => (i === index ? { ...row, max: Number(e.target.value) } : row)))}
                      />
                      <button
                        className="rounded-lg px-2 text-slate-500 hover:text-rose-700 dark:text-rose-300"
                        onClick={() => setRubric((rows) => rows.filter((_, i) => i !== index))}
                        aria-label="Remove criterion"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={createAssignment} loading={busy === "create"} className="w-full">
                Create assignment
              </Button>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {!detail ? (
            <Card>
              <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="Select an assignment" description="Pick an assignment to review the submission queue." />
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{detail.assignment.course.code} · {detail.assignment.course.title}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{detail.assignment.title}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">{detail.assignment.prompt}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="neutral">{detail.enrolled ?? 0} enrolled</Badge>
                    <Badge tone="brand">{detail.assignment.max_marks} marks</Badge>
                    <Badge tone="accent">Rubric · {detail.assignment.rubric?.length ?? 0} criteria</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.assignment.rubric?.map((item) => (
                    <span key={item.criterion} className="rounded-lg border border-line/70 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                      {item.criterion} · {item.max}
                    </span>
                  ))}
                </div>
              </Card>

              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
                  <CardTitle>Submission queue</CardTitle>
                  <span className="text-xs text-slate-500">{detail.submissions?.length ?? 0} submitted</span>
                </div>
                {(detail.submissions?.length ?? 0) === 0 ? (
                  <div className="p-5">
                    <EmptyState icon={<FileText className="h-7 w-7" />} title="No submissions yet" description="Students will appear here once they upload their work." />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                        <tr className="border-b border-line/60">
                          <th className="px-5 py-3 font-medium">Student</th>
                          <th className="px-3 py-3 font-medium">Submitted</th>
                          <th className="px-3 py-3 font-medium">Peer similarity</th>
                          <th className="px-3 py-3 font-medium">AI likelihood</th>
                          <th className="px-3 py-3 font-medium">Suggested</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.submissions!.map((submission) => (
                          <tr key={submission.id} className="border-b border-line/40 last:border-0">
                            <td className="px-5 py-3">
                              <p className="font-medium text-slate-800">{submission.student_name}</p>
                              <p className="text-[11px] text-slate-500">{submission.roll_no || submission.filename}</p>
                            </td>
                            <td className="px-3 py-3 text-slate-600">{timeAgo(submission.created_at)}</td>
                            <td className="px-3 py-3">
                              {submission.status === "submitted" ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <Badge tone={integrityTone(submission.plagiarism_pct ?? 0)}>{submission.plagiarism_pct ?? 0}%</Badge>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {submission.status === "submitted" ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <Badge tone={integrityTone(submission.ai_probability ?? 0)}>{submission.ai_probability ?? 0}%</Badge>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-700">
                              {submission.suggested_score != null ? `${submission.suggested_score}/${detail.assignment.max_marks}` : "—"}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={submission.status} />
                              {submission.status === "approved" && submission.final_score != null && (
                                <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">Published {submission.final_score}/{detail.assignment.max_marks}</p>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {submission.status === "approved" ? (
                                <Button size="sm" variant="secondary" onClick={() => openDraft(submission)}>
                                  <FileText className="h-3.5 w-3.5" /> View submission
                                </Button>
                              ) : submission.status === "reviewed" ? (
                                <Button size="sm" variant="secondary" onClick={() => openDraft(submission)}>
                                  Open review
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" loading={busy === `review-${submission.id}`} onClick={() => runReview(submission)}>
                                  <Sparkles className="h-3.5 w-3.5" /> Run AI review
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {review && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8">
          <div className="w-full max-w-6xl rounded-2xl border border-line bg-[#0b0b13] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${readOnly ? "text-emerald-400" : "text-brand"}`}>
                  {readOnly ? "Published grade · read-only" : "AI teaching assistant · human approval required"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {review.student_name} <span className="text-sm font-normal text-slate-500">· {review.filename}</span>
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={integrityTone(review.plagiarism_pct ?? 0)}><ShieldAlert className="h-3 w-3" /> Peer {review.plagiarism_pct ?? 0}%</Badge>
                  <Badge tone={integrityTone(review.ai_probability ?? 0)}><Bot className="h-3 w-3" /> AI {review.ai_probability ?? 0}%</Badge>
                  <Badge tone="neutral">{review.feedback?.mode === "offline" ? "Local rubric engine" : `LLM · ${review.feedback?.mode}`}</Badge>
                </div>
              </div>
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => setReview(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[75vh] gap-0 overflow-y-auto lg:grid-cols-[1.15fr_1fr]">
              <div className="border-b border-line/70 p-5 lg:border-b-0 lg:border-r">
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                  <FileText className="h-4 w-4" /> Submission text
                </div>
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/60 bg-black/30 p-4 text-[13px] leading-relaxed text-slate-700">
                  {review.text}
                </div>
                {(review.ai_probability ?? 0) >= 35 && (
                  <div className="mt-4 rounded-xl border border-warn/25 bg-warn/5 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      <Bot className="h-3.5 w-3.5" /> AI-writing signals
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                      {Object.entries(review.feedback?.ai_signals || {}).map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <p className="text-slate-500">{key.replaceAll("_", " ")}</p>
                          <p className="text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(review.plagiarism_matches?.length ?? 0) > 0 && (
                  <div className="mt-4 rounded-xl border border-danger/25 bg-danger/5 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      <ShieldAlert className="h-3.5 w-3.5" /> Closest peer matches
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {review.plagiarism_matches!.map((match) => (
                        <div key={match.student_name} className="flex items-center justify-between text-xs text-slate-700">
                          <span>{match.student_name}</span>
                          <span className="text-rose-700 dark:text-rose-300">{match.similarity}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{readOnly ? "Published marks" : "AI-suggested marks"}</p>
                  <p className="text-sm text-slate-700">
                    <span className="text-lg font-semibold text-slate-900">{draftTotal}</span>
                    <span className="text-slate-500"> / {detail?.assignment.max_marks ?? 10}</span>
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  {draft.criteria.map((item, index) => (
                    <div key={`${item.criterion}-${index}`} className="rounded-xl border border-line/60 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-800">{item.criterion}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={item.max}
                            step={0.5}
                            value={item.score}
                            disabled={readOnly}
                            onChange={(e) => {
                              const score = Math.max(0, Math.min(item.max, Number(e.target.value) || 0));
                              setDraft((d) => ({ ...d, criteria: d.criteria.map((c, i) => (i === index ? { ...c, score } : c)) }));
                            }}
                            className="h-9 w-20 rounded-lg border border-line bg-canvas px-2 text-right text-sm text-slate-900 focus:border-brand/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                          />
                          <span className="text-xs text-slate-500">/ {item.max}</span>
                        </div>
                      </div>
                      <textarea
                        value={item.comment}
                        disabled={readOnly}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, criteria: d.criteria.map((c, i) => (i === index ? { ...c, comment: e.target.value } : c)) }))
                        }
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-line/60 bg-black/20 px-2.5 py-2 text-xs text-slate-700 focus:border-brand/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Label>Feedback summary</Label>
                  <Textarea rows={3} value={draft.summary} disabled={readOnly} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} />
                </div>
                {(draft.strengths.length > 0 || draft.improvements.length > 0) && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {draft.strengths.length > 0 && (
                      <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Strengths</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
                          {draft.strengths.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {draft.improvements.length > 0 && (
                      <div className="rounded-xl border border-warn/20 bg-warn/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Improvements</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
                          {draft.improvements.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-5 flex items-center justify-end gap-2">
                  {readOnly ? (
                    <Button variant="secondary" onClick={() => setReview(null)}>
                      Close
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={() => runReview(review)} loading={busy === `review-${review.id}`}>
                        Re-run analysis
                      </Button>
                      <Button variant="ghost" onClick={() => setReview(null)}>
                        Cancel
                      </Button>
                      <Button onClick={approve} loading={busy === "approve"}>
                        <CheckCircle2 className="h-4 w-4" /> Approve & publish
                      </Button>
                    </>
                  )}
                </div>
                <p className="mt-2 text-right text-[11px] text-slate-400">
                  {readOnly ? `Published grade is final · ${review.final_score ?? draftTotal}/${detail?.assignment.max_marks ?? 10}` : "Students only see the published grade after approval."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentView({
  assignments,
  selectedId,
  detail,
  onSelect,
  onRefresh,
  setError,
}: {
  assignments: Assignment[];
  selectedId: number | null;
  detail: Detail | null;
  onSelect: (id: number) => void;
  onRefresh: () => void;
  setError: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mySubmission = useMemo(() => detail?.my_submission ?? assignments.find((a) => a.id === selectedId)?.my_submission ?? null, [assignments, detail, selectedId]);

  async function submit() {
    if (!selectedId) return;
    if (!file && text.trim().split(/\s+/).filter(Boolean).length < 40) {
      setError("Paste at least 40 words or upload a PDF/text file.");
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("text", text);
      if (file) body.append("file", file);
      const response = await fetch(`${API}/api/eval/assignments/${selectedId}/submit`, {
        method: "POST",
        body,
        credentials: "include",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.detail === "string" ? payload.detail : "Submission failed");
      }
      setText("");
      setFile(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[340px_1fr]">
      <Card className="p-4">
        <CardTitle className="mb-3">Your assignments</CardTitle>
        <div className="space-y-2">
          {assignments.length === 0 && <p className="text-sm text-slate-500">No assignments for your courses yet.</p>}
          {assignments.map((assignment) => {
            const active = assignment.id === selectedId;
            const submission = assignment.my_submission;
            return (
              <button
                key={assignment.id}
                onClick={() => onSelect(assignment.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  active ? "border-brand/40 bg-brand/10" : "border-line/70 bg-slate-50 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="neutral">{assignment.course.code}</Badge>
                  <span className="text-[11px] text-slate-500">{assignment.max_marks} marks</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">{assignment.title}</p>
                <div className="mt-2">
                  {!submission ? (
                    <Badge tone="neutral">Not submitted</Badge>
                  ) : submission.status === "approved" ? (
                    <Badge tone="success">Graded · {submission.final_score}/{assignment.max_marks}</Badge>
                  ) : submission.status === "under_review" ? (
                    <Badge tone="warn">Under review</Badge>
                  ) : (
                    <Badge tone="brand">Submitted</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="space-y-4">
        {!detail ? (
          <Card>
            <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="Select an assignment" description="Open an assignment to submit your work or read feedback." />
          </Card>
        ) : (
          <>
            <Card>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{detail.assignment.course.code} · {detail.assignment.course.title}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{detail.assignment.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{detail.assignment.prompt}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.assignment.rubric?.map((item) => (
                  <span key={item.criterion} className="rounded-lg border border-line/70 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                    {item.criterion} · {item.max}
                  </span>
                ))}
              </div>
              {detail.assignment.due_date && (
                <p className="mt-3 text-xs text-slate-500">Due {formatDateTime(detail.assignment.due_date)}</p>
              )}
            </Card>

            {mySubmission?.status === "approved" && mySubmission.feedback ? (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Published feedback</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">Reviewed by {detail.assignment.course.code} faculty</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl border border-success/30 bg-success/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {mySubmission.final_score}/{detail.assignment.max_marks}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-700">{mySubmission.feedback.summary}</p>
                {mySubmission.text && (
                  <details className="mt-4 rounded-xl border border-line/60 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Read your submitted answer
                    </summary>
                    <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {mySubmission.text}
                    </div>
                  </details>
                )}
                <div className="mt-4 space-y-2">
                  {mySubmission.feedback.criteria?.map((criterion) => (
                    <div key={criterion.criterion} className="rounded-xl border border-line/60 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{criterion.criterion}</span>
                        <span className="text-slate-600">{criterion.score}/{criterion.max}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{criterion.comment}</p>
                    </div>
                  ))}
                </div>
                {((mySubmission.feedback.strengths?.length ?? 0) > 0 ||
                  (mySubmission.feedback.improvements?.length ?? 0) > 0) && (
                  <div
                    className={`mt-4 grid gap-3 ${
                      (mySubmission.feedback.strengths?.length ?? 0) > 0 &&
                      (mySubmission.feedback.improvements?.length ?? 0) > 0
                        ? "sm:grid-cols-2"
                        : ""
                    }`}
                  >
                    {(mySubmission.feedback.strengths?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Strengths</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
                          {mySubmission.feedback.strengths!.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(mySubmission.feedback.improvements?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-warn/20 bg-warn/5 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Next steps</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
                          {mySubmission.feedback.improvements!.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle>{mySubmission ? "Submission status" : "Submit your work"}</CardTitle>
                  {mySubmission && <StatusBadge status={mySubmission.status} />}
                </div>
                {mySubmission ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-line/60 bg-slate-50 p-4 text-sm text-slate-700">
                      <p>
                        <span className="text-slate-500">File:</span> {mySubmission.filename} · submitted {timeAgo(mySubmission.created_at)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {mySubmission.status === "under_review"
                          ? "Your faculty is reviewing this submission. The AI draft stays hidden until it is published."
                          : "Waiting for review. You can replace the submission until it is graded."}
                      </p>
                    </div>
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <FileText className="h-4 w-4" /> Your submitted answer
                      </p>
                      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/60 bg-white p-4 text-sm leading-relaxed text-slate-700">
                        {mySubmission.text || "No text was stored for this submission."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Upload a PDF or text file</Label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-slate-50 px-4 py-4 text-sm text-slate-600 transition hover:border-brand/40 hover:text-slate-800">
                        <Upload className="h-4 w-4" />
                        {file ? file.name : "Choose a .pdf, .txt or .md file"}
                        <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <div>
                      <Label>Or paste your answer</Label>
                      <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste at least 40 words…" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-slate-500">Uploading replaces any earlier submission before grading.</p>
                      <Button onClick={submit} loading={submitting}>
                        Submit assignment
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
