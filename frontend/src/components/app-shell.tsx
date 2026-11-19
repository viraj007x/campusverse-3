"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  Menu,
  Radar,
  ScanFace,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth, type Role } from "@/lib/auth";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Boxes;
  roles: readonly Role[];
  group: string;
};

const NAV: readonly NavItem[] = [
  { href: "/app", label: "Overview", icon: Boxes, roles: ["student", "faculty", "admin"], group: "Workspace" },
  { href: "/app/copilot", label: "SAMVIT AI", icon: Bot, roles: ["student", "faculty", "admin"], group: "Workspace" },
  { href: "/app/attendance", label: "VisionGuard", icon: ScanFace, roles: ["student", "faculty", "admin"], group: "Workspace" },
  { href: "/app/crowd", label: "Crowd Analytics", icon: Radar, roles: ["faculty", "admin"], group: "Workspace" },
  { href: "/app/lost-found", label: "Lost & Found", icon: Boxes, roles: ["student", "faculty", "admin"], group: "Workspace" },
  { href: "/app/performance", label: "Performance", icon: Activity, roles: ["student", "faculty", "admin"], group: "Intelligence" },
  { href: "/app/grading", label: "EvalAI Grader", icon: ClipboardCheck, roles: ["student", "faculty", "admin"], group: "Intelligence" },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3, roles: ["faculty", "admin"], group: "Intelligence" },
  { href: "/app/placement", label: "Placement Studio", icon: GraduationCap, roles: ["student", "faculty", "admin"], group: "Intelligence" },
];

const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "Administrator",
};

function Logo() {
  return (
    <Link href="/app" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-solid shadow-sm">
        <GraduationCap className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
      </span>
      <span className="leading-none">
        <span className="block text-[15px] font-bold tracking-tight text-slate-900">CampusVerse</span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Graphic Era Hill University</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [brain, setBrain] = useState<{ documents: number; chunks: number } | null>(null);
  const [brainDown, setBrainDown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    api<{ documents: unknown[]; chunks: number }>("/api/rag/status")
      .then((status) => { if (alive) { setBrain({ documents: status.documents.length, chunks: status.chunks }); setBrainDown(false); } })
      .catch(() => { if (alive) setBrainDown(true); });
    return () => { alive = false; };
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading workspace…
        </div>
      </div>
    );
  }

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const current = items.find((n) => n.href === pathname) ?? items.find((n) => pathname.startsWith(`${n.href}/`));
  const groups = Array.from(new Set(items.map((n) => n.group)));
  const matches = query.trim()
    ? items.filter((n) => `${n.label} ${n.group}`.toLowerCase().includes(query.trim().toLowerCase()))
    : [];
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[58px] items-center justify-between border-b border-line px-4">
        <Logo />
        <button className="text-slate-400 hover:text-slate-700 lg:hidden" onClick={() => setOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group}</p>
            <nav className="space-y-0.5">
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition",
                        active
                          ? "bg-brand/5 text-brand before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r before:bg-brand"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <item.icon
                        className={cn("h-4 w-4", active ? "text-brand" : "text-slate-400 group-hover:text-slate-600")}
                        strokeWidth={1.9}
                      />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3 w-3 text-brand" />}
                    </Link>
                  );
                })}
            </nav>
          </div>
        ))}

        <div className="mx-1 rounded-md border border-line bg-surface-2 p-3">
          <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", brainDown ? "text-amber-600" : "text-emerald-600")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", brainDown ? "bg-amber-500" : "bg-emerald-500")} />
            {brainDown ? "SAMVIT reconnecting…" : "SAMVIT online"}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            {brain ? `${brain.documents} documents · ${brain.chunks.toLocaleString("en-IN")} chunks indexed` : "Connecting to the knowledge brain…"}
          </p>
        </div>
      </div>

      <div className="border-t border-line p-2.5">
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-[10px] text-slate-400">
              {user.role === "student" ? user.roll_no || user.email : user.email}
            </p>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] border-r border-line bg-white lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-[236px]">
        <header className="sticky top-0 z-30 flex h-[58px] items-center justify-between gap-3 border-b border-line border-t-[3px] border-t-brand bg-white px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="truncate text-[12.5px] text-slate-400">
              <span className="hidden sm:inline">Graphic Era Hill University</span>
              <span className="mx-1.5 hidden text-slate-300 sm:inline">/</span>
              <span className="font-semibold text-slate-800">{current?.label ?? "Overview"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="Search modules…"
                className="h-8 w-52 rounded-md border border-line bg-surface-2 pl-8 pr-3 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
              />
              {searchOpen && query.trim() && (
                <div className="absolute right-0 top-9 z-40 w-64 overflow-hidden rounded-md border border-line bg-white shadow-lg">
                  {matches.length ? (
                    matches.map((m) => (
                      <button
                        key={m.href}
                        onMouseDown={() => {
                          router.push(m.href);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                      >
                        <m.icon className="h-3.5 w-3.5 text-slate-400" />
                        {m.label}
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400">{m.group}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-[11.5px] text-slate-400">No matching modules</p>
                  )}
                </div>
              )}
            </div>

            <div className="hidden items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 text-[10.5px] font-semibold text-slate-600 sm:flex">
              <Users className="h-3 w-3 text-brand" />
              {ROLE_LABEL[user.role]}
            </div>
            <ThemeToggle />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
              {initials}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
