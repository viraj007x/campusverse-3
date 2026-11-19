"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Award,
  Bot,
  Camera,
  CameraOff,
  Check,
  FileText,
  GraduationCap,
  Map,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Target,
  Upload,
  Video,
  X,
} from "lucide-react";
import { API, api, timeAgo } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, CardTitle, EmptyState, Input, Label, PageHeader, Spinner, Textarea } from "@/components/ui";

type Resume = {
  exists: boolean;
  filename?: string;
  characters?: number;
  skills?: string[];
  created_at?: string;
};

type RoadmapItem = {
  skill: string;
  why?: string;
  steps?: string[];
  duration_weeks?: number;
};

type MatchResult = {
  id: number;
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
  roadmap: RoadmapItem[];
  resume_skills: string[];
  created_at: string;
};

type MatchRow = {
  id: number;
  jd_title: string;
  score: number;
  missing_skills: string[];
  created_at: string;
};

type StartRes = { id: number; role_title: string; questions: string[]; mode: string };

type Evaluation = { score: number; feedback: string; strengths: string[]; improve: string[] };
type Turn = { question: string; answer: string } & Evaluation;
type InterviewResult = { overall_score: number; level: string; summary: string; answered: number };
type AnswerRes = {
  evaluation: Evaluation;
  answered: number;
  total: number;
  next_question: string | null;
  result: InterviewResult | null;
};
type InterviewRow = {
  id: number;
  role_title: string;
  questions: number;
  answered: number;
  result: InterviewResult | null;
  created_at: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function formatCallTime(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const SAMPLE_JDS: { label: string; title: string; jd: string }[] = [
  {
    label: "ML Engineer",
    title: "Machine Learning Engineer",
    jd: `Role: Machine Learning Engineer (Entry Level)
Location: Bengaluru (Hybrid)

We are looking for a final-year graduate to join our applied AI team.

Responsibilities:
- Build and deploy machine learning models with Python, scikit-learn and PyTorch
- Work with structured and unstructured data using SQL and pandas
- Develop REST APIs with FastAPI and containerise services using Docker
- Build retrieval and LLM-powered features with embeddings and vector databases
- Present model metrics and experiments to product stakeholders

Required skills:
- Strong Python, NumPy, pandas
- Understanding of classical ML and deep learning
- SQL and data visualisation
- Familiarity with Git, Docker, and cloud platforms (AWS/GCP)
- Excellent communication and problem solving`,
  },
  {
    label: "Data Analyst",
    title: "Data Analyst",
    jd: `Role: Data Analyst (Graduate)
Location: Gurugram (On-site)

About the role:
You will turn raw product and operations data into decisions for business teams.

Responsibilities:
- Write SQL queries against PostgreSQL and maintain dashboards
- Clean and analyse datasets with Python, pandas and NumPy
- Apply statistics to validate experiments and explain variance
- Present findings with clear charts and written summaries
- Automate recurring reports

Required skills:
- SQL, Excel and data visualisation
- Python and pandas
- Statistics and hypothesis testing
- Understanding of data cleaning and EDA
- Strong communication and problem solving`,
  },
  {
    label: "Frontend Developer",
    title: "Frontend Developer",
    jd: `Role: Frontend Developer (Entry Level)
Location: Remote (India)

We build a customer-facing SaaS dashboard used by 40,000 teams.

Responsibilities:
- Build accessible interfaces with React and TypeScript
- Style components with Tailwind CSS and HTML/CSS
- Consume REST and GraphQL APIs and handle loading and error states
- Write unit tests with Jest and review pull requests
- Work with designers in Figma to ship pixel-accurate screens

Required skills:
- JavaScript, TypeScript and React
- HTML/CSS and Tailwind CSS
- Git and CI/CD basics
- Understanding of REST APIs and browser performance
- Communication and attention to detail`,
  },
  {
    label: "Full Stack Developer",
    title: "Full Stack Developer",
    jd: `Role: Full Stack Developer (Graduate)
Location: Pune (Hybrid)

Responsibilities:
- Build full-stack features with Next.js and Node.js
- Design REST APIs and model data in SQL and MongoDB
- Add authentication, role-based access and input validation
- Deploy services with Docker on AWS and monitor them in production
- Collaborate with product and QA in two-week Agile sprints

Required skills:
- JavaScript or TypeScript with React/Next.js
- Node.js, REST APIs and SQL
- Git, Docker and CI/CD
- Understanding of testing and system design basics
- Clear written communication`,
  },
  {
    label: "Backend Engineer",
    title: "Backend Engineer",
    jd: `Role: Backend Engineer (Entry Level)
Location: Hyderabad (On-site)

Responsibilities:
- Build and maintain services with Python (FastAPI/Flask) or Java (Spring Boot)
- Model relational schemas in PostgreSQL and write efficient SQL
- Cache hot reads in Redis and design idempotent APIs
- Package services with Docker and deploy through CI/CD pipelines
- Debug production issues on Linux and add structured logging

Required skills:
- Python or Java, REST API design
- SQL, DBMS and indexing fundamentals
- Docker, Linux and Git
- Understanding of concurrency and system design
- Problem solving and teamwork`,
  },
  {
    label: "DevOps / Cloud",
    title: "DevOps Engineer",
    jd: `Role: DevOps Engineer (Entry Level)
Location: Bengaluru (Hybrid)

Responsibilities:
- Maintain CI/CD pipelines for 30+ microservices
- Run containerised workloads with Docker and Kubernetes on AWS
- Automate infrastructure with Linux shell scripting and IaC
- Set up monitoring, alerting and cost dashboards
- Support developers with build and release issues

Required skills:
- Linux, bash and Git
- Docker, Kubernetes and CI/CD
- AWS (EC2, S3) and cloud networking basics
- Scripting in Python
- Incident communication and problem solving`,
  },
  {
    label: "Security Analyst",
    title: "Cyber Security Analyst",
    jd: `Role: Cyber Security Analyst (Graduate)
Location: Noida (On-site)

Responsibilities:
- Monitor alerts from SIEM and triage suspicious activity
- Review application code for injection, XSS and access-control flaws
- Run vulnerability scans and track remediation to closure
- Document incidents and write clear post-incident reports
- Support secure SDLC reviews with engineering teams

Required skills:
- Computer networks and TCP/IP fundamentals
- Operating systems and Linux
- Understanding of OWASP risks and secure coding
- Python or bash for automation
- Communication and analytical thinking`,
  },
  {
    label: "Business Analyst",
    title: "Business Analyst",
    jd: `Role: Business Analyst (Graduate)
Location: Bengaluru (Hybrid)

Responsibilities:
- Gather requirements from stakeholders and write user stories
- Analyse product data in SQL and Excel to size opportunities
- Build dashboards for weekly business reviews
- Coordinate with engineering and design in Agile sprints
- Present recommendations to senior leadership

Required skills:
- SQL and data analysis
- Excel and data visualisation
- Agile and stakeholder communication
- Statistics basics
- Structured problem solving`,
  },
];

function ScoreRing({ score, label, size = 148 }: { score: number; label?: string; size?: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  const tone = score >= 70 ? "#12b76a" : score >= 45 ? "#f79009" : "#f04438";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="9" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-slate-900">{score}%</span>
        {label && <span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      </div>
    </div>
  );
}

function SkillChip({ skill, ok }: { skill: string; ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]",
        ok ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" : "border-rose-400/25 bg-rose-400/10 text-rose-700 dark:text-rose-300"
      )}
    >
      {ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {skill}
    </span>
  );
}

export default function PlacementPage() {
  const [tab, setTab] = useState<"match" | "interview">("match");
  const [resume, setResume] = useState<Resume>({ exists: false });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [jdTitle, setJdTitle] = useState("Machine Learning Engineer");
  const [jdText, setJdText] = useState("");
  const [matching, setMatching] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [history, setHistory] = useState<MatchRow[]>([]);

  const [role, setRole] = useState("Machine Learning Engineer");
  const [interview, setInterview] = useState<StartRes | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [finalResult, setFinalResult] = useState<InterviewResult | null>(null);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseRef = useRef("");
  const micOnRef = useRef(false);

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    if (!interview || finalResult) return;
    setCallSeconds(0);
    const timer = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [interview, finalResult]);

  useEffect(() => {
    if (!interview) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        setCamOn(true);
      })
      .catch(() => {
        setCamOn(false);
        setVoiceError("Camera unavailable. Check browser permission; you can still answer by typing.");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [interview]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  }, [camOn, interview]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setMicOn(false);
  }

  function startListening() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setVoiceError("Voice input is not supported in this browser. Type your answer instead.");
      return;
    }
    recognitionRef.current?.stop();
    const Recognition = (window.SpeechRecognition || window.webkitSpeechRecognition)!;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    speechBaseRef.current = answer.trim();
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setAnswer([speechBaseRef.current, transcript.trim()].filter(Boolean).join(" "));
    };
    recognition.onend = () => {
      setListening(false);
      setMicOn(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event: any) => {
      if (event?.error !== "no-speech" && event?.error !== "aborted") {
        setVoiceError(`Microphone error: ${event?.error || "unknown"}. You can type instead.`);
      }
      setListening(false);
      setMicOn(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
    setMicOn(true);
    setVoiceError("");
  }

  function speakQuestion(text: string, autoListen = true) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      if (autoListen) startListening();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.98;
    utterance.pitch = 1;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().includes("en-in"));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      if (autoListen && micOnRef.current) startListening();
    };
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  async function toggleMic() {
    if (listening) {
      stopListening();
      return;
    }
    setMicOn(true);
    startListening();
  }

  async function toggleCamera() {
    if (camOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => undefined);
      }
      setCamOn(true);
      setVoiceError("");
    } catch {
      setVoiceError("Camera permission was denied. You can continue with audio or typed answers.");
    }
  }

  function endCall() {
    stopListening();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamOn(false);
    setSpeaking(false);
    setInterview(null);
    setCurrent(null);
  }

  const callStatus = useMemo(() => {
    if (finalResult) return "Interview completed";
    if (speaking) return "SAMVIT is speaking";
    if (evaluating) return "Evaluating your answer";
    if (listening) return "Listening to you";
    return "Call connected";
  }, [evaluating, finalResult, listening, speaking]);

  const [error, setError] = useState("");

  const loadMeta = useCallback(async () => {
    try {
      const [r, h, iv] = await Promise.all([
        api<Resume>("/api/placement/resume"),
        api<MatchRow[]>("/api/placement/matches"),
        api<InterviewRow[]>("/api/placement/interviews"),
      ]);
      setResume(r);
      setHistory(h);
      setInterviews(iv);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("401"))) {
        setError(err instanceof Error ? err.message : "Failed to load placement data");
      }
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  async function uploadResume(file: File) {
    setUploading(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch(`${API}/api/placement/resume`, { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Resume upload failed");
      setResume({ exists: true, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function runMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!jdText.trim()) return;
    setMatching(true);
    setError("");
    try {
      const res = await api<MatchResult>("/api/placement/match", {
        method: "POST",
        json: { jd_title: jdTitle || "Untitled role", jd_text: jdText },
      });
      setResult(res);
      loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match failed");
    } finally {
      setMatching(false);
    }
  }

  async function startInterview() {
    setError("");
    setVoiceError("");
    setTurns([]);
    setFinalResult(null);
    setAnswer("");
    setEvaluating(true);
    stopListening();
    try {
      const res = await api<StartRes>("/api/placement/interview/start", {
        method: "POST",
        json: { role_title: role || "Software Engineer" },
      });
      setInterview(res);
      setCurrent(res.questions[0] ?? null);
      setMicOn(true);
      if (res.questions[0]) speakQuestion(res.questions[0]);
      loadMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start interview");
    } finally {
      setEvaluating(false);
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!interview || !current || !answer.trim()) return;
    stopListening();
    setEvaluating(true);
    setError("");
    try {
      const res = await api<AnswerRes>("/api/placement/interview/answer", {
        method: "POST",
        json: { interview_id: interview.id, answer },
      });
      setTurns((prev) => [...prev, { question: current, answer, ...res.evaluation }]);
      setAnswer("");
      if (res.result) {
        setFinalResult(res.result);
        setCurrent(null);
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        loadMeta();
      } else {
        setCurrent(res.next_question);
        if (res.next_question) speakQuestion(res.next_question, micOnRef.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not evaluate answer");
    } finally {
      setEvaluating(false);
    }
  }

  const answerWords = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Module 03 · Multimodal"
        title="Placement Studio"
        description="Score your resume against any job description, get a personalised learning roadmap, and rehearse with an AI interviewer that grades every answer."
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <button
              onClick={() => setTab("match")}
              className={cn("rounded-lg px-3 py-1.5 text-[12px] transition", tab === "match" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700")}
            >
              Skill match
            </button>
            <button
              onClick={() => setTab("interview")}
              className={cn("rounded-lg px-3 py-1.5 text-[12px] transition", tab === "interview" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700")}
            >
              Mock interview
            </button>
          </div>
        }
      />

      {error && <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {tab === "match" ? (
        <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle>Your resume</CardTitle>
                {resume.exists && (
                  <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} loading={uploading}>
                    <RefreshCw className="h-3.5 w-3.5" /> Replace
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadResume(file);
                  e.target.value = "";
                }}
              />
              {resume.exists ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 py-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] text-slate-800">{resume.filename}</p>
                      <p className="text-[10.5px] text-slate-500">
                        {resume.characters?.toLocaleString()} characters · {resume.skills?.length ?? 0} skills detected
                      </p>
                    </div>
                  </div>
                  {!!resume.skills?.length && (
                    <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {resume.skills.map((s) => (
                        <Badge key={s} tone="brand">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-canvas px-4 py-8 text-center hover:border-brand/50"
                  disabled={uploading}
                >
                  {uploading ? <Spinner /> : <Upload className="h-5 w-5 text-brand" />}
                  <span className="text-[12px] text-slate-700">Upload resume (PDF or text)</span>
                  <span className="text-[10.5px] text-slate-400">Under 5 MB · parsed for skill extraction</span>
                </button>
              )}
              <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">
                Try the resume in <span className="text-slate-600">data/samples/resume_jane_doe.pdf</span>. Nothing leaves this server.
              </p>
            </Card>

            <Card>
              <CardTitle>Recent matches</CardTitle>
              <div className="mt-2.5 space-y-1">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg px-1.5 py-1.5 text-[11.5px]">
                    <div className="min-w-0">
                      <p className="truncate text-slate-700">{h.jd_title}</p>
                      <p className="text-[10px] text-slate-400">{timeAgo(h.created_at)}</p>
                    </div>
                    <span className={cn("font-mono", h.score >= 70 ? "text-emerald-700 dark:text-emerald-300" : h.score >= 45 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300")}>
                      {h.score}%
                    </span>
                  </div>
                ))}
                {history.length === 0 && <p className="py-3 text-center text-[11px] text-slate-400">No matches yet.</p>}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle>Target job description</CardTitle>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sample profiles</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SAMPLE_JDS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setJdTitle(s.title);
                        setJdText(s.jd);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition",
                        jdTitle === s.title && jdText === s.jd
                          ? "border-brand/50 bg-brand/10 text-brand"
                          : "border-line text-slate-500 hover:border-brand/40 hover:text-slate-800"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">Tap a profile to fill the role title and job description, or paste your own.</p>
              </div>
              <form onSubmit={runMatch} className="mt-3 space-y-3">
                <div>
                  <Label>Role title</Label>
                  <Input value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} placeholder="Machine Learning Engineer" />
                </div>
                <div>
                  <Label>Paste the JD</Label>
                  <Textarea
                    rows={9}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the full job description here — responsibilities, requirements, preferred skills…"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10.5px] text-slate-400">
                    {resume.exists ? "Compared against your latest uploaded resume." : "Upload a resume first for an accurate match."}
                  </p>
                  <Button type="submit" loading={matching} disabled={!jdText.trim() || !resume.exists}>
                    <Target className="h-4 w-4" /> Analyse fit
                  </Button>
                </div>
              </form>
            </Card>

            {result && (
              <Card className="animate-fade-up">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <ScoreRing score={result.score} label="Job fit" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{jdTitle}</h3>
                      <Badge tone={result.score >= 70 ? "success" : result.score >= 45 ? "warn" : "danger"}>
                        {result.score >= 70 ? "Strong fit" : result.score >= 45 ? "Developing fit" : "Needs work"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{result.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {result.matched_skills.map((s) => (
                        <SkillChip key={s} skill={s} ok />
                      ))}
                      {result.missing_skills.map((s) => (
                        <SkillChip key={s} skill={s} ok={false} />
                      ))}
                    </div>
                  </div>
                </div>

                {result.roadmap.length > 0 && (
                  <div className="mt-5 border-t border-line/70 pt-4">
                    <div className="flex items-center gap-2">
                      <Map className="h-3.5 w-3.5 text-brand" />
                      <p className="text-[12px] font-medium text-slate-800">Personalised roadmap</p>
                    </div>
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {result.roadmap.map((r, i) => (
                        <div key={r.skill + i} className="rounded-xl border border-line/70 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12.5px] font-medium text-slate-900">{r.skill}</p>
                            {!!r.duration_weeks && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{r.duration_weeks}w</span>
                            )}
                          </div>
                          {r.why && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{r.why}</p>}
                          {!!r.steps?.length && (
                            <ul className="mt-2 space-y-1">
                              {r.steps.map((step, j) => (
                                <li key={j} className="flex gap-1.5 text-[11px] leading-snug text-slate-600">
                                  <ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-brand" />
                                  {step}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardTitle>Start a mock interview</CardTitle>
              <div className="mt-3 space-y-3">
                <div>
                  <Label>Target role</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Data Analyst" />
                </div>
                <Button className="w-full" onClick={startInterview} loading={evaluating && !interview}>
                  <MessageSquare className="h-4 w-4" /> {interview ? "New interview" : "Begin interview"}
                </Button>
                <p className="text-[10.5px] leading-relaxed text-slate-400">
                  Five questions: three technical, one project-based, one behavioural. Each answer is graded 0–100 with feedback.
                </p>
              </div>
            </Card>

            <Card>
              <CardTitle>Past interviews</CardTitle>
              <div className="mt-2.5 space-y-1">
                {interviews.map((iv) => (
                  <div key={iv.id} className="flex items-center justify-between rounded-lg px-1.5 py-1.5 text-[11.5px]">
                    <div className="min-w-0">
                      <p className="truncate text-slate-700">{iv.role_title}</p>
                      <p className="text-[10px] text-slate-400">
                        {iv.answered}/{iv.questions} answered · {timeAgo(iv.created_at)}
                      </p>
                    </div>
                    {iv.result ? (
                      <span className={cn("font-mono", iv.result.overall_score >= 75 ? "text-emerald-700 dark:text-emerald-300" : iv.result.overall_score >= 55 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300")}>
                        {iv.result.overall_score}
                      </span>
                    ) : (
                      <Badge tone="neutral">open</Badge>
                    )}
                  </div>
                ))}
                {interviews.length === 0 && <p className="py-3 text-center text-[11px] text-slate-400">No interviews yet.</p>}
              </div>
            </Card>
          </div>

          <div>
            {!interview ? (
              <EmptyState
                icon={<GraduationCap className="h-8 w-8" />}
                title="Your AI interviewer is ready"
                description="Pick a target role and start a five-question interview. Questions adapt to the skills detected in your resume, and every answer is scored with specific feedback."
                action={<Button onClick={startInterview} loading={evaluating}><MessageSquare className="h-4 w-4" /> Start now</Button>}
              />
            ) : (
              <Card className="overflow-hidden !p-0">
                <div className="bg-[#0a1018] text-white">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{interview.role_title} · AI video interview</p>
                      <p className="text-[11px] text-slate-400">{callStatus} · {formatCallTime(callSeconds)}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge tone={interview.mode === "offline" ? "neutral" : "brand"}>
                        {interview.mode === "offline" ? "on-device scoring" : "LLM interviewer"}
                      </Badge>
                      <span className="hidden items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-300 sm:inline-flex">
                        <Video className="h-3 w-3" /> {interview.questions.length} questions
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2.5 px-3 pb-3 sm:grid-cols-2 sm:px-4">
                    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#16233a] via-[#101a2c] to-[#0b1220]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(228,37,39,0.25),transparent_55%)]" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand to-rose-500 shadow-[0_0_60px_rgba(228,37,39,0.45)]">
                          {speaking && <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />}
                          <Bot className="relative h-9 w-9 text-white" />
                        </div>
                        <div className="mt-3 flex h-6 items-end gap-1">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <span
                              key={i}
                              className={cn("w-1 rounded-full bg-white/70 transition-all duration-300", speaking ? "animate-pulse" : "")}
                              style={{ height: speaking ? `${8 + ((i * 7) % 20)}px` : `${4 + (i % 3) * 2}px`, animationDelay: `${i * 90}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="absolute bottom-2.5 left-3 flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[10px] backdrop-blur">
                        <AudioLines className={cn("h-3 w-3", speaking ? "text-emerald-400" : "text-slate-400")} />
                        SAMVIT · AI interviewer
                      </div>
                    </div>

                    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#111827]">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn("h-full w-full scale-x-[-1] object-cover transition-opacity", camOn ? "opacity-100" : "opacity-0")}
                      />
                      {!camOn && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                          <div className="grid h-16 w-16 place-items-center rounded-full bg-white/5">
                            <CameraOff className="h-7 w-7" />
                          </div>
                          <p className="mt-2 text-[11px]">Camera off</p>
                        </div>
                      )}
                      <div className="absolute bottom-2.5 left-3 flex items-center gap-2 rounded-full bg-black/50 px-2.5 py-1 text-[10px] backdrop-blur">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> You
                      </div>
                      {listening && (
                        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-medium text-white">
                          <Mic className="h-3 w-3" /> Listening
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/20 px-4 py-3">
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-full border transition",
                        listening ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-300" : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                      )}
                      title={listening ? "Stop microphone" : "Start microphone"}
                    >
                      {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={toggleCamera}
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-full border transition",
                        camOn ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                      )}
                      title={camOn ? "Turn camera off" : "Turn camera on"}
                    >
                      {camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                    </button>
                    <div className="hidden items-center gap-2 px-1 text-[11px] text-slate-400 sm:flex">
                      <span className={cn("h-1.5 w-1.5 rounded-full", speaking ? "bg-brand" : listening ? "bg-emerald-400" : "bg-slate-500")} />
                      {callStatus}
                    </div>
                    <button
                      type="button"
                      onClick={endCall}
                      className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-rose-600 px-4 text-[12px] font-medium text-white transition hover:bg-rose-500"
                    >
                      <PhoneOff className="h-4 w-4" /> End call
                    </button>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all duration-500"
                      style={{ width: `${(turns.length / Math.max(1, interview.questions.length)) * 100}%` }}
                    />
                  </div>

                  {voiceError && (
                    <p className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{voiceError}</p>
                  )}

                  {current && (
                    <div className="rounded-xl border border-brand/20 bg-brand/[0.05] p-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                          Question {turns.length + 1} of {interview.questions.length}
                        </p>
                        <button
                          type="button"
                          onClick={() => speakQuestion(current, false)}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-brand"
                        >
                          <AudioLines className="h-3 w-3" /> Replay question
                        </button>
                      </div>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-900">{current}</p>
                    </div>
                  )}

                  {current && (
                    <form onSubmit={submitAnswer} className="rounded-xl border border-line/70 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Your answer · live transcript</p>
                        <button
                          type="button"
                          onClick={listening ? stopListening : startListening}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition",
                            listening ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-line text-slate-600 hover:border-brand/40"
                          )}
                        >
                          {listening ? <><Mic className="h-3 w-3" /> Stop</> : <><MicOff className="h-3 w-3" /> Speak</>}
                        </button>
                      </div>
                      <Textarea
                        rows={3}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Speak naturally, or type here. Structure: situation → approach → result."
                        disabled={evaluating}
                        className="mt-2 resize-none"
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] text-slate-400">
                          {answerWords} words
                          {answerWords < 6
                            ? " · write at least a full sentence to submit"
                            : listening
                              ? " · transcribing live"
                              : " · mic off"}
                        </p>
                        <Button type="submit" loading={evaluating} disabled={answerWords < 6}>
                          Send answer <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </form>
                  )}

                  {!!turns.length && (
                    <details className="rounded-xl border border-line/70 bg-slate-50/60 p-3">
                      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Reviewed answers ({turns.length})
                      </summary>
                      <div className="mt-3 space-y-3">
                        {turns.map((t, i) => (
                          <div key={i} className="rounded-lg border border-line/60 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[11.5px] font-medium text-slate-800">Q{i + 1}. {t.question}</p>
                              <span className={cn("shrink-0 font-mono text-[11px]", t.score >= 75 ? "text-emerald-600" : t.score >= 55 ? "text-amber-600" : "text-rose-600")}>
                                {t.score}/100
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-slate-600">{t.answer}</p>
                            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t.feedback}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {finalResult && (
                    <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/10 to-accent/5 p-4 text-center">
                      <Award className="mx-auto h-6 w-6 text-brand" />
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{finalResult.overall_score}/100</p>
                      <p className="text-[11px] uppercase tracking-wider text-brand">{finalResult.level}</p>
                      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-slate-600">{finalResult.summary}</p>
                      <div className="mt-3 flex justify-center gap-2">
                        <Button size="sm" variant="secondary" onClick={startInterview}>
                          <RefreshCw className="h-3.5 w-3.5" /> Try another interview
                        </Button>
                        <Button size="sm" variant="outline" onClick={endCall}>
                          <PhoneOff className="h-3.5 w-3.5" /> Leave call
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
