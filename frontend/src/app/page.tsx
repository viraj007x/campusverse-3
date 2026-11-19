import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Database,
  GraduationCap,
  Layers,
  Lock,
  Radar,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Users,
  Waypoints,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

const modules = [
  {
    icon: Bot,
    tag: "Workspace · GenAI",
    title: "SAMVIT AI",
    description:
      "Your campus copilot with a university knowledge brain and a 32,593-learner OULAD intelligence layer. Ask anything in English, Hindi or Hinglish and get cited answers.",
    points: ["Grounded in 8 campus documents", "Five specialist agents", "Streaming answers with citations"],
  },
  {
    icon: ScanFace,
    tag: "Workspace · Vision",
    title: "VisionGuard Attendance",
    description:
      "Face recognition with challenge-response liveness detection for proxy-free classrooms, with live roster confirmation and CSV exports.",
    points: ["YuNet detection + SFace embeddings", "Head-turn liveness challenge", "Session roster in real time"],
  },
  {
    icon: Radar,
    tag: "Workspace · Vision",
    title: "Crowd Analytics",
    description:
      "YOLOv8 person counting for campus spaces with zone history, occupancy trends and annotated frames for administrators.",
    points: ["Person counting per zone", "History and trend charts", "Annotated frame previews"],
  },
  {
    icon: Boxes,
    tag: "Workspace · Multimodal",
    title: "Lost & Found",
    description:
      "CLIP-powered visual matching connects reported items with found ones by image similarity, not keywords.",
    points: ["Image-to-image similarity", "Automatic match suggestions", "Claim workflow per role"],
  },
  {
    icon: Activity,
    tag: "Intelligence · ML",
    title: "Performance Intelligence",
    description:
      "A real 32,593-learner OULAD cohort driving risk prediction, VLE-engagement forecasting, clustering, anomaly detection and personalised interventions.",
    points: ["Risk, dropout and score prediction", "Digital twin + what-if simulator", "Explainable decision rules"],
  },
  {
    icon: ClipboardCheck,
    tag: "Intelligence · GenAI",
    title: "EvalAI Grader",
    description:
      "LLM-assisted answer-sheet evaluation with rubric scoring, feedback generation and faculty review before marks are released.",
    points: ["Rubric-based scoring", "Feedback per answer", "Faculty override trail"],
  },
  {
    icon: GraduationCap,
    tag: "Intelligence · Career",
    title: "Placement Studio",
    description:
      "Resume ↔ JD gap scoring, skill-gap analysis and an AI mock interviewer with rubric feedback for placement readiness.",
    points: ["Resume vs JD fit score", "Skill gap breakdown", "AI mock interviews"],
  },
  {
    icon: BarChart3,
    tag: "Intelligence · Admin",
    title: "Analytics",
    description:
      "Campus-wide query, attendance and engagement analytics so administrators can see usage, sources and outcomes in one place.",
    points: ["Copilot usage and sources", "Attendance registers", "Cohort and department views"],
  },
];

const pipeline = [
  { icon: Layers, title: "Next.js workspace", copy: "Role-aware ERP shell, compact tables, streaming UI." },
  { icon: Waypoints, title: "FastAPI gateway", copy: "JWT auth, RBAC, async APIs, SSE streaming." },
  { icon: BrainCircuit, title: "Intelligence layer", copy: "SAMVIT agents, ML suite, RAG, vision, CLIP." },
  { icon: Database, title: "Data layer", copy: "SQLite records, Chroma vectors, indexed PDFs." },
];

const models = [
  ["XGBoost", "Academic risk", "AUC 0.881"],
  ["Random Forest", "Risk classifier", "F1 0.791"],
  ["LightGBM", "SGPA forecast", "R² 0.927"],
  ["Random Forest", "VLE engagement", "R² 0.702"],
  ["K-Means", "Learner clusters", "5 segments"],
  ["Decision Tree", "Explainable factors", "6 rules"],
  ["Isolation Forest", "Anomalies", "815 flagged"],
];

const stats = [
  ["32,593", "real OULAD learner records"],
  ["8", "indexed campus documents"],
  ["17,208", "learners flagged high risk"],
  ["815", "Isolation Forest anomalies"],
];

function PreviewWindow() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_60px_-30px_rgba(16,24,40,0.35)]">
      <div className="flex items-center justify-between border-b border-line border-t-[3px] border-t-brand bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-brand">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-[11px] font-bold text-slate-900">CampusVerse</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ERP · AI</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> SAMVIT online
        </div>
      </div>

      <div className="grid grid-cols-[92px_1fr]">
        <div className="border-r border-line bg-surface-2 p-2">
          {[
            { label: "Overview", icon: Boxes, active: false },
            { label: "SAMVIT AI", icon: Bot, active: true },
            { label: "Attendance", icon: ScanFace, active: false },
            { label: "Performance", icon: Activity, active: false },
            { label: "Grader", icon: ClipboardCheck, active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`mb-0.5 flex items-center gap-1.5 rounded px-1.5 py-1.5 text-[10px] font-medium ${
                item.active ? "bg-brand/5 text-brand" : "text-slate-500"
              }`}
            >
              <item.icon className="h-3 w-3" />
              {item.label}
            </div>
          ))}
          <div className="mt-2 rounded border border-line bg-white p-1.5 text-[10px] leading-snug text-slate-500">
            <span className="font-bold text-emerald-600">Brain ready</span> · 8 docs · 6 models
          </div>
        </div>

        <div className="bg-canvas p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Workspace</p>
              <p className="text-[12px] font-semibold text-slate-900">SAMVIT AI</p>
            </div>
            <span className="rounded border border-line bg-white px-1.5 py-0.5 text-[10px] text-slate-500">Faculty view</span>
          </div>

          <div className="rounded-md border border-line bg-white p-2.5">
            <div className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10">
                <Sparkles className="h-3 w-3 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-slate-500">SAMVIT</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-slate-700">
                  17,208 learners (52.8%) are high risk and 1,751 are on the watchlist. Top drivers: VLE engagement,
                  assignment average, previous score.
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded border border-brand/25 bg-brand/5 px-1 py-0.5 text-[10px] text-brand-strong">
                    Performance brain
                  </span>
                  <span className="rounded border border-line bg-surface-2 px-1 py-0.5 text-[10px] text-slate-500">
                    XGBoost · AUC 0.881
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { label: "Engagement risk", value: "15,955", icon: Activity },
              { label: "Anomalies", value: "815", icon: Radar },
              { label: "Avg SGPA", value: "5.56", icon: GraduationCap },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-md border border-line bg-white p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                  <Icon className="h-2.5 w-2.5 text-brand" />
                </div>
                <p className="mt-1 text-[13px] font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 rounded-md border border-line bg-white p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Risk distribution</p>
              <span className="text-[10px] text-slate-400">OULAD cohort</span>
            </div>
            <div className="flex h-10 items-end gap-1">
              {[38, 52, 44, 66, 49, 72, 61, 83].map((h, i) => (
                <div
                  key={i}
                  className={i >= 5 ? "flex-1 rounded-t-sm bg-brand" : "flex-1 rounded-t-sm bg-slate-300"}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="h-[3px] w-full bg-brand" />

      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-solid shadow-sm">
              <GraduationCap className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
            </span>
            <span className="leading-none">
              <span className="block text-[15px] font-bold tracking-tight text-slate-900">CampusVerse</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Graphic Era Hill University
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 md:flex">
            <a href="#modules" className="transition hover:text-slate-900">Modules</a>
            <a href="#intelligence" className="transition hover:text-slate-900">Intelligence</a>
            <a href="#architecture" className="transition hover:text-slate-900">Architecture</a>
            <a href="#roles" className="transition hover:text-slate-900">Roles</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-solid px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Open demo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="animate-fade-up">
            <Badge tone="brand" className="mb-5 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Graphic Era Hill University · SAMVIT AI
            </Badge>
            <h1 className="max-w-xl text-[42px] font-semibold leading-[1.06] tracking-tight text-slate-900 sm:text-[54px]">
              Run the campus.
              <br />
              <span className="text-gradient">Ask SAMVIT anything.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-600">
              CampusVerse is Graphic Era Hill University&apos;s unified campus ERP with an AI brain: proxy-free
              attendance, crowd analytics, an academic copilot grounded in your institution&apos;s documents, and
              performance intelligence trained on real anonymised Open University (OULAD) learner records.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-solid px-5 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                Enter the platform <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#modules"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-line bg-white px-4 text-[14px] font-medium text-slate-700 transition hover:border-line-strong hover:text-slate-900"
              >
                <Layers className="h-4 w-4 text-brand" /> Explore modules
              </a>
            </div>
            <div className="mt-9 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {stats.map(([value, label]) => (
                <div key={label}>
                  <p className="text-xl font-bold tracking-tight text-slate-900">{value}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-up delay-2">
            <PreviewWindow />
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Role-based access
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" /> Runs fully on-premise
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> No API key required
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Modules</p>
              <h2 className="mt-1.5 text-[28px] font-semibold tracking-tight text-slate-900">
                One ERP shell, every campus workflow
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Grouped navigation, compact tables and white surfaces keep every module predictable — while each one
                ships its own model and evaluation story.
              </p>
            </div>
            <Badge tone="neutral" className="hidden sm:inline-flex">
              <Zap className="h-3 w-3 text-amber-500" /> Next.js + FastAPI + Chroma + OpenCV + CLIP
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map((m, i) => (
              <div
                key={m.title}
                className={`group rounded-lg border border-line bg-white p-4 transition hover:border-line-strong hover:shadow-[0_8px_24px_-16px_rgba(16,24,40,0.3)] animate-fade-up delay-${(i % 4) + 1}`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex rounded-md bg-brand/5 p-2 ring-1 ring-brand/10">
                    <m.icon className="h-4 w-4 text-brand" strokeWidth={1.9} />
                  </span>
                  <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Module {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{m.tag}</p>
                <h3 className="mt-1 text-[15px] font-semibold text-slate-900">{m.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{m.description}</p>
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {m.points.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-[11.5px] text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="intelligence" className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Intelligence layer</p>
            <h2 className="mt-1.5 text-[28px] font-semibold tracking-tight text-slate-900">
              Seven models, one decision surface
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Performance intelligence is trained on the real OULAD cohort — 32,593 anonymised Open University learner
              records (CC BY 4.0). Every prediction carries its drivers, confidence and an intervention suggestion.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                ["Risk prediction", "XGBoost reaches AUC 0.881 and F1 0.793 on a held-out 20% of the real cohort."],
                ["Engagement forecast", "Random Forest predicts active VLE study days with R² 0.702 and MAE 5.89 points."],
                ["Cohort structure", "K-Means segments learners into 5 groups, from high performers to critical support."],
                ["Anomaly watch", "Isolation Forest flags 815 learners (2.5%) with unusual engagement or score patterns."],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-md border border-line bg-white p-3.5">
                  <p className="text-[12.5px] font-semibold text-slate-900">{title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-slate-900">Model benchmark</h3>
              <span className="rounded border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                32.6k rows · 80/20 split
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-line">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="bg-surface-2 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2 font-bold">Model</th>
                    <th className="px-3 py-2 font-bold">Task</th>
                    <th className="px-3 py-2 text-right font-bold">Headline metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {models.map(([model, task, metric]) => (
                    <tr key={`${model}-${task}`} className="bg-white text-slate-600 transition hover:bg-surface-2">
                      <td className="px-3 py-2 font-medium text-slate-900">{model}</td>
                      <td className="px-3 py-2">{task}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-brand-strong">{metric}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-md border border-line bg-surface-2 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Records come from the Open University Learning Analytics Dataset (CC BY 4.0), anonymised by the
                publisher. Attendance is represented by VLE engagement; skills, certifications and internships are
                derived estimates, not dataset fields.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="architecture" className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Architecture</p>
              <h2 className="mt-1.5 text-[28px] font-semibold tracking-tight text-slate-900">
                One request path, every module
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-600">
              A single Next.js client talks to a FastAPI gateway that enforces JWT auth and RBAC before routing to
              the RAG, vision, ML or embedding engines. Everything runs locally on a laptop — no external API key required.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {pipeline.map((step, i) => (
              <div key={step.title} className="relative rounded-md border border-line bg-surface-2 p-4">
                <span className="font-mono text-[10px] text-slate-400">0{i + 1}</span>
                <step.icon className="mt-2 h-4.5 w-4.5 text-brand" strokeWidth={1.9} />
                <p className="mt-2.5 text-[12.5px] font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{step.copy}</p>
                {i < pipeline.length - 1 && (
                  <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-slate-300 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Roles</p>
          <h2 className="mt-1.5 text-[28px] font-semibold tracking-tight text-slate-900">
            A different surface for each persona
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              role: "Students",
              icon: GraduationCap,
              items: [
                "Ask SAMVIT cited questions on rules and syllabus",
                "Enroll once, walk in to mark attendance",
                "See your digital twin, risk drivers and what-if",
                "Score resumes and rehearse interviews",
              ],
            },
            {
              role: "Faculty",
              icon: ScanFace,
              items: [
                "Start a liveness-checked classroom session",
                "Watch the roster confirm in real time",
                "Review at-risk cohorts and interventions",
                "Export CSV attendance registers",
              ],
            },
            {
              role: "Administrators",
              icon: Users,
              items: [
                "Monitor campus-wide occupancy and anomalies",
                "Track SAMVIT usage, sources and models",
                "Manage documents and re-index the corpus",
                "Retrain models and audit activity",
              ],
            },
          ].map((r) => (
            <div key={r.role} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-brand/5 p-2 ring-1 ring-brand/10">
                  <r.icon className="h-4 w-4 text-brand" strokeWidth={1.9} />
                </span>
                <h3 className="text-[14px] font-semibold text-slate-900">{r.role}</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {r.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12.5px] text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-line border-l-[3px] border-l-brand bg-white p-7 sm:p-9">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Ready for the viva?</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
              Sign in with a demo student, faculty or admin account and walk through every module with seeded data.
              No setup beyond the local servers.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-solid px-5 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            Launch CampusVerse <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-[11.5px] text-slate-500 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-brand">
              <GraduationCap className="h-3 w-3 text-white" />
            </span>
            Graphic Era Hill University · CampusVerse with SAMVIT AI
          </div>
          <p>Performance intelligence on real OULAD learner records · CC BY 4.0</p>
        </div>
      </footer>
    </div>
  );
}
