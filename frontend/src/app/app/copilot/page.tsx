"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileText,
  GraduationCap,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  User,
  Users,
} from "lucide-react";
import { API, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, CardTitle, Spinner, Textarea } from "@/components/ui";

type Source = {
  doc_id: string;
  title: string;
  page?: number | null;
  snippet: string;
  score: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  mode?: string;
  latency?: number;
  streaming?: boolean;
  agent?: string;
};

type Status = {
  indexing: boolean;
  chunks: number;
  llm_mode: string;
  documents: { doc_id: string; title: string; filename: string; pages: number; chunks: number }[];
  brain?: {
    documents: number;
    chunks: number;
    records: number;
    high_risk: number;
    attendance_risk: number;
    anomalies: number;
    models: number;
    clusters: number;
  } | null;
};

type HistoryItem = {
  id: number;
  question: string;
  answer: string;
  sources: Source[];
  mode: string;
  created_at: string;
};

type AgentId = "samvit" | "risk" | "attendance" | "placement" | "faculty";

const AGENTS: { id: AgentId; label: string; icon: typeof Bot; hint: string; roles?: string[] }[] = [
  { id: "samvit", label: "SAMVIT", icon: Sparkles, hint: "Policy, academics, campus knowledge" },
  { id: "risk", label: "Risk Analyst", icon: ShieldAlert, hint: "Academic risk and interventions" },
  { id: "attendance", label: "Engagement Coach", icon: HeartPulse, hint: "VLE engagement and recovery plans" },
  { id: "placement", label: "Career Mentor", icon: GraduationCap, hint: "Readiness, skills and career fit" },
  { id: "faculty", label: "Faculty Assistant", icon: Users, hint: "Cohort intelligence and outliers", roles: ["faculty", "admin"] },
];

const SUGGESTIONS: Record<AgentId, string[]> = {
  samvit: [
    "How many students are high risk?",
    "Which module has the weakest VLE engagement?",
    "When do the end semester exams start?",
    "What CGPA is required for product company placements?",
    "Show the semester-wise SGPA trend",
    "What is the attendance policy for condonation?",
  ],
  risk: [
    "How many students are high risk?",
    "Which departments carry the most academic risk?",
    "What are the main drivers of academic risk?",
    "Summarise the students who need intervention",
  ],
  attendance: [
    "How many learners are forecast below the engagement target?",
    "What does low VLE engagement signal for completion?",
    "Which presentation has the lowest engagement forecast?",
  ],
  placement: [
    "Which cluster is most placement ready?",
    "What skills are missing for product company placements?",
    "How is placement readiness distributed?",
  ],
  faculty: [
    "Show the students flagged as anomalies",
    "Summarise the cohort clusters",
    "Which students need faculty intervention?",
  ],
};

function modeLabel(mode?: string) {
  if (!mode || mode === "offline") return "local engine";
  if (mode === "offline-fallback") return "local fallback";
  return mode;
}

function uid() {  return Math.random().toString(36).slice(2);
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite) {
      return (
        <span
          key={key}
          className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-brand/10 px-1 align-super font-mono text-[10px] font-semibold text-brand"
        >
          {cite[1]}
        </span>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function AnswerBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-700">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1.5" />;
        if (/^[-*•]\s+/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span>{renderInline(trimmed.replace(/^[-*•]\s+/, ""), `l${i}`)}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const [, num, rest] = trimmed.match(/^(\d+)\.\s+(.*)$/) || [];
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="font-mono text-[11px] font-semibold text-brand">{num}.</span>
              <span>{renderInline(rest || "", `n${i}`)}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(trimmed, `p${i}`)}</p>;
      })}
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!sources.length) return null;
  return (
    <div className="mt-3 border-t border-line pt-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <BookOpen className="h-3 w-3" /> Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <button
            key={`${s.doc_id}-${i}`}
            onClick={() => setOpen(open === i ? null : i)}
            className={cn(
              "rounded border px-2 py-1 text-left text-[10.5px] transition",
              open === i
                ? "border-brand/40 bg-brand/5 text-brand"
                : "border-line bg-slate-50 text-slate-600 hover:border-brand/30 hover:text-slate-800"
            )}
          >
            <span className="font-mono font-semibold text-brand">[{i + 1}]</span> {s.title}
            {s.page ? ` · p.${s.page}` : ""}
          </button>
        ))}
      </div>
      {open !== null && sources[open] && (
        <div className="mt-2 rounded-md border border-line bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {sources[open].title} {sources[open].page ? `· page ${sources[open].page}` : ""}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{sources[open].snippet}</p>
        </div>
      )}
    </div>
  );
}

export default function CopilotPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState<AgentId>("samvit");
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [docError, setDocError] = useState("");
  const docInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadStatus = () => api<Status>("/api/rag/status").then(setStatus).catch(() => {});
  const loadHistory = () => api<HistoryItem[]>("/api/rag/history").then(setHistory).catch(() => {});

  useEffect(() => {
    loadStatus();
    loadHistory();
    const timer = setInterval(loadStatus, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const agents = AGENTS.filter((a) => !a.roles || (user && a.roles.includes(user.role)));
  const active = agents.find((a) => a.id === agent) ?? agents[0];

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: Message = { id: uid(), role: "user", content: q };
    const botId = uid();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: botId, role: "assistant", content: "", sources: [], streaming: true, agent },
    ]);

    const update = (patch: Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, ...patch } : m)));

    try {
      const res = await fetch(`${API}/api/rag/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, agent }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(detail.detail || "Request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let sources: Source[] = [];
      let mode = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = "message";
          let data = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === "sources") {
            sources = payload as unknown as Source[];
            update({ sources });
          } else if (event === "token") {
            answer += String((payload as { t: string }).t || "");
            update({ content: answer });
          } else if (event === "done") {
            mode = String((payload as { mode: string }).mode || "");
            update({
              streaming: false,
              mode,
              latency: Number((payload as { latency_ms: number }).latency_ms || 0),
            });
          } else if (event === "meta") {
            update({ mode: "offline-fallback" });
          }
        }
      }
      update({ streaming: false, content: answer || "No answer generated." });
      loadHistory();
      loadStatus();
    } catch (err) {
      update({
        streaming: false,
        content:
          (err instanceof Error ? err.message : "Something went wrong") +
          "\n\nMake sure the API is running on http://localhost:8100.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function reindex() {
    try {
      await api("/api/rag/ingest?force=true", { method: "POST" });
      setStatus((s) => (s ? { ...s, indexing: true } : s));
    } catch {
      /* ignore */
    }
  }

  async function uploadDoc(file: File) {
    setDocError("");
    setDocBusy("upload");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API}/api/rag/upload`, { method: "POST", credentials: "include", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : "Upload failed");
      }
      setStatus((s) => (s ? { ...s, indexing: true } : s));
      setTimeout(loadStatus, 5000);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setDocBusy(null);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  async function removeDoc(doc: Status["documents"][number]) {
    if (!window.confirm(`Remove "${doc.title}" from the knowledge base? The source file is deleted as well.`)) return;
    setDocError("");
    setDocBusy(doc.doc_id);
    try {
      await api(`/api/rag/docs/${doc.doc_id}`, { method: "DELETE" });
      await loadStatus();
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Could not remove the document");
    } finally {
      setDocBusy(null);
    }
  }

  function loadHistoryItem(item: HistoryItem) {
    setMessages([
      { id: uid(), role: "user", content: item.question },
      {
        id: uid(),
        role: "assistant",
        content: item.answer,
        sources: item.sources || [],
        mode: item.mode,
        streaming: false,
      },
    ]);
  }

  const canReindex = user && (user.role === "faculty" || user.role === "admin");
  const brain = status?.brain;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="flex min-h-[calc(100vh-140px)] flex-col overflow-hidden rounded-[10px] border border-line bg-white">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10">
                <Bot className="h-4.5 w-4.5 text-brand" />
              </span>
              <div>
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
                  SAMVIT
                  <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                    AI
                  </span>
                </p>
                <p className="text-[10.5px] text-slate-500">
                  {brain ? `${brain.records.toLocaleString("en-IN")} learner records · ${brain.documents} documents` : "Campus intelligence assistant"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="success">
                {status?.llm_mode === "groq" || status?.llm_mode === "openai"
                  ? `online · ${status.llm_mode}`
                  : "online · local knowledge engine"}
              </Badge>
              <Badge tone="neutral">{status?.chunks ?? 0} chunks</Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgent(a.id)}
                title={a.hint}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] font-semibold transition",
                  agent === a.id
                    ? "border-brand/30 bg-brand/5 text-brand"
                    : "border-line bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <a.icon className="h-3 w-3" />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto bg-canvas/40 px-4 py-5 sm:px-6">
          {messages.length === 0 && (
            <div className="mx-auto mt-6 max-w-2xl">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-brand/15 bg-brand/5">
                  <Sparkles className="h-6 w-6 text-brand" />
                </div>
                <h2 className="mt-3 text-[18px] font-semibold tracking-tight text-slate-900">
                  {active?.hint ?? "Ask anything about campus life"}
                </h2>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  Grounded in the university knowledge brain and 32,593 real OULAD learner records — open-domain questions get general-knowledge answers, with citations and live analytics.
                </p>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS[agent].map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-md border border-line bg-white px-3.5 py-2.5 text-left text-[12px] text-slate-700 transition hover:border-brand/40 hover:bg-brand/[0.03]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand/10">
                  <Bot className="h-3.5 w-3.5 text-brand" />
                </span>
              )}
              <div className={cn("max-w-[86%]", m.role === "user" && "order-first")}>
                <div
                  className={cn(
                    "rounded-lg px-4 py-3",
                    m.role === "user"
                      ? "bg-brand-solid text-white"
                      : "border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                  )}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.content}</p>
                  ) : m.content ? (
                    <AnswerBody text={m.content} />
                  ) : (
                    <div className="typing-dots py-1">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {m.role === "assistant" && m.sources && m.sources.length > 0 && !m.streaming && (
                    <SourceList sources={m.sources} />
                  )}
                </div>
                {m.role === "assistant" && !m.streaming && (m.mode || m.latency) && (
                  <p className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                    <Clock3 className="h-2.5 w-2.5" /> {m.latency} ms
                    <span>·</span> {modeLabel(m.mode)}
                    <span>·</span> {m.mode === "analytics" ? "performance brain" : "hybrid retrieval"}
                  </p>
                )}
              </div>
              {m.role === "user" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100">
                  <User className="h-3.5 w-3.5 text-slate-600" />
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-line bg-white px-4 py-3.5 sm:px-5">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder={`Ask ${active?.label ?? "SAMVIT"} anything — campus, risk, engagement, placements…`}
              className="resize-none pr-24"
            />
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
              <span className="hidden text-[10px] text-slate-400 sm:block">Enter to send</span>
              <Button size="sm" onClick={() => ask(input)} disabled={!input.trim() || busy} className="h-8 px-3">
                {busy ? <Spinner className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            SAMVIT refuses to answer outside the indexed corpus and the performance brain. Verify critical deadlines with the department office.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <CardTitle>Brain status</CardTitle>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> online
            </span>
          </div>
          {brain ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: "Learners", value: brain.records.toLocaleString("en-IN"), icon: Users },
                { label: "Documents", value: brain.documents, icon: FileText },
                { label: "High risk", value: brain.high_risk, icon: ShieldAlert },
                { label: "Engagement risk", value: brain.attendance_risk, icon: HeartPulse },
                { label: "Anomalies", value: brain.anomalies, icon: Brain },
                { label: "Models", value: brain.models, icon: Database },
              ].map((s) => (
                <div key={s.label} className="rounded-md border border-line bg-slate-50 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <s.icon className="h-3 w-3 text-brand" /> {s.label}
                  </div>
                  <p className="mt-0.5 text-[16px] font-semibold tracking-tight text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11.5px] text-slate-500">Performance brain is warming up…</p>
          )}
          <div className="mt-2.5 flex items-center gap-2 rounded border border-line bg-white px-2.5 py-2 text-[10.5px] text-slate-500">
            <Database className="h-3 w-3 text-brand" /> ChromaDB · cosine + BM25 fusion
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <CardTitle>Knowledge base</CardTitle>
            <div className="flex items-center gap-2 text-slate-400">
              {canReindex && (
                <>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.md,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDoc(file);
                    }}
                  />
                  <button
                    type="button"
                    title="Add a document (PDF, Markdown or text)"
                    aria-label="Add a document"
                    onClick={() => docInputRef.current?.click()}
                    disabled={docBusy !== null || status?.indexing}
                    className="rounded p-1 transition hover:bg-slate-50 hover:text-brand disabled:opacity-50"
                  >
                    {docBusy === "upload" ? <Spinner className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                  </button>
                </>
              )}
              <a
                href={`${API}/api/rag/export`}
                title="Download the full knowledge base (.zip)"
                aria-label="Download knowledge base"
                className="rounded p-1 transition hover:bg-slate-50 hover:text-brand"
              >
                <Download className="h-3 w-3" />
              </a>
              {canReindex && (
                <button
                  onClick={reindex}
                  disabled={status?.indexing}
                  className="flex items-center gap-1 text-[10.5px] font-semibold text-brand hover:text-brand-strong disabled:opacity-50"
                >
                  {status?.indexing ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />} Re-index
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {canReindex ? "Add PDF, Markdown or text · 20 MB max · download any file or the full zip" : "Download any document or the full knowledge base"}
          </p>
          {docError && <p className="mt-1 text-[10.5px] text-rose-500">{docError}</p>}
          <div className="mt-2.5 max-h-[260px] space-y-1.5 overflow-y-auto">
            {(status?.documents || []).map((d) => (
              <div key={d.doc_id} className="flex items-start gap-2 rounded border border-line bg-slate-50/60 px-2.5 py-2">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] text-slate-700">{d.title}</p>
                  <p className="text-[10px] text-slate-400">
                    {d.pages} pages · {d.chunks} chunks
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`${API}/api/rag/docs/${d.doc_id}/download`}
                    title={`Download ${d.filename}`}
                    aria-label={`Download ${d.title}`}
                    className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-brand"
                  >
                    <Download className="h-3 w-3" />
                  </a>
                  {canReindex && (
                    <button
                      type="button"
                      title="Remove from knowledge base"
                      aria-label={`Remove ${d.title}`}
                      onClick={() => removeDoc(d)}
                      disabled={docBusy === d.doc_id}
                      className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-rose-500 disabled:opacity-50"
                    >
                      {docBusy === d.doc_id ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {status && status.documents.length === 0 && (
              <div className="rounded border border-dashed border-line px-3 py-4 text-center text-[11px] text-slate-500">
                {status.indexing ? "Indexing corpus… first run downloads the embedding model." : "No documents indexed yet."}
              </div>
            )}
          </div>
        </Card>

        <Card className="!p-4">
          <CardTitle>Recent questions</CardTitle>
          <div className="mt-2.5 space-y-1.5">
            {history.slice(0, 6).map((h) => (
              <button
                key={h.id}
                onClick={() => loadHistoryItem(h)}
                className="w-full rounded border border-line bg-white px-2.5 py-2 text-left transition hover:border-brand/40 hover:bg-brand/[0.02]"
              >
                <p className="line-clamp-2 text-[11.5px] text-slate-700">{h.question}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                  <CheckCircle2 className="h-2.5 w-2.5" /> {modeLabel(h.mode)} · {h.sources?.length || 0} sources
                </p>
              </button>
            ))}
            {history.length === 0 && <p className="text-[11.5px] text-slate-500">Your conversation history will appear here.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
