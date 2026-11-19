"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  GraduationCap,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Label } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

const DEMO_ACCOUNTS = [
  {
    label: "Student",
    email: "student@campus.edu",
    password: "Student@123",
    icon: GraduationCap,
    hint: "SAMVIT · attendance · performance",
  },
  {
    label: "Faculty",
    email: "faculty@campus.edu",
    password: "Faculty@123",
    icon: ScanFace,
    hint: "Sessions · crowd · analytics",
  },
  {
    label: "Admin",
    email: "admin@campus.edu",
    password: "Admin@123",
    icon: UserCog,
    hint: "Full campus + models oversight",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { refresh, user } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("student@campus.edu");
  const [password, setPassword] = useState("Student@123");
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace("/app");
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading("form");
    try {
      if (mode === "login") {
        await api("/api/auth/login", { method: "POST", json: { email, password } });
      } else {
        await api("/api/auth/register", {
          method: "POST",
          json: { name, email, password, roll_no: rollNo || null },
        });
      }
      await refresh();
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function demoLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setError("");
    setLoading(account.label);
    try {
      await api("/api/auth/login", {
        method: "POST",
        json: { email: account.email, password: account.password },
      });
      await refresh();
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed. Is the API running on port 8100?");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative flex min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
      <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-brand/20 blur-[120px]" />
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <aside className="relative hidden w-[46%] flex-col justify-between border-r border-line/70 bg-white/80 p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-solid shadow-sm">
            <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">
            Campus<span className="text-brand">Verse</span>
          </span>
        </Link>

        <div className="max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
            Graphic Era Hill University
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Campus ERP · SAMVIT AI
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-slate-900">
            The campus,
            <br />
            <span className="text-gradient">wired with intelligence.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            One login for SAMVIT, your campus copilot, alongside proxy-free attendance, occupancy analytics,
            performance intelligence, EvalAI grading and an AI placement studio.
          </p>

          <div className="mt-9 space-y-3">
            {[
              { icon: Bot, title: "Cited answers, not guesses", copy: "Every response links to the source document and page." },
              { icon: ScanFace, title: "Liveness-checked attendance", copy: "Face recognition with a head-turn challenge defeats photo spoofing." },
              { icon: ShieldCheck, title: "Role-scoped by default", copy: "Students, faculty and admins each get a different surface." },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl border border-line/70 bg-slate-50 p-3.5">
                <span className="rounded-lg bg-brand/15 p-2">
                  <f.icon className="h-4 w-4 text-brand" />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-slate-800">{f.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">{f.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          B.Tech CSE · 7th Semester Major Project · Graphic Era Hill University
        </p>
      </aside>

      <main className="relative flex w-full items-center justify-center px-5 py-12 lg:w-[54%]">
        <div className="w-full max-w-md animate-fade-up">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-slate-700 lg:hidden">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {mode === "login" ? "Sign in to your Graphic Era Hill University workspace." : "Register as a student — you can enroll your face right after."}
              </p>
            </div>
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] text-slate-500">
              v1.0
            </span>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.label}
                onClick={() => demoLogin(account)}
                disabled={loading !== null}
                className="group rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand/50 hover:bg-surface-2 disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <account.icon className="h-4 w-4 text-brand" />
                  {loading === account.label ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-slate-200 border-t-brand" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-brand" />
                  )}
                </div>
                <p className="mt-2 text-[12.5px] font-medium text-slate-800">{account.label}</p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{account.hint}</p>
              </button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-line" /> or use the form <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aditi Menon" required />
                </div>
                <div>
                  <Label>Roll number</Label>
                  <Input value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="23CS107" />
                </div>
              </>
            )}
            <div>
              <Label>Institute email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@campus.edu"
                required
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-rose-700 dark:text-rose-300">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading === "form"}>
              {mode === "login" ? "Sign in" : "Create account"} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-[12.5px] text-slate-500">
            {mode === "login" ? "New to CampusVerse? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="font-medium text-brand hover:text-brand-strong"
            >
              {mode === "login" ? "Create a student account" : "Sign in"}
            </button>
          </p>

          <p className="mt-8 text-center text-[10.5px] leading-relaxed text-slate-400">
            Demo credentials are pre-filled. Attendance requires a webcam; all other modules work without one.
          </p>
        </div>
      </main>
    </div>
  );
}
