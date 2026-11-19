"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ImageUp,
  MapPin,
  Radio,
  Radar,
  ScanLine,
  Upload,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, formatDateTime } from "@/lib/api";
import { useWebcam, fileToDataUrl } from "@/lib/use-webcam";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, CardTitle, Input, Label, PageHeader, Select, Spinner, StatCard } from "@/components/ui";

type CrowdResult = { count: number; annotated: string; zone: string; boxes: { confidence: number }[] };
type Sample = { zone: string; count: number; created_at: string };
type Zone = { zone: string; count: number; created_at: string };

const ZONES = ["Central Library", "Main Canteen", "E-Block Food Court", "Main Auditorium"];

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-ink)",
  boxShadow: "0 8px 24px -12px rgba(16, 24, 40, 0.25)",
};

export default function CrowdPage() {
  const [zone, setZone] = useState(ZONES[0]);
  const [live, setLive] = useState(false);
  const [result, setResult] = useState<CrowdResult | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const { videoRef, ready, error: camError, capture } = useWebcam(live);

  const loadHistory = useCallback(async () => {
    try {
      const [h, z] = await Promise.all([
        api<Sample[]>(`/api/vision/crowd/history?zone=${encodeURIComponent(zone)}&limit=48`),
        api<Zone[]>("/api/vision/crowd/zones"),
      ]);
      setHistory(h);
      setZones(z);
    } catch {
      /* ignore */
    }
  }, [zone]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const scan = useCallback(
    async (image: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setScanning(true);
      setError("");
      try {
        const res = await api<CrowdResult>("/api/vision/crowd", { method: "POST", json: { image, zone } });
        setResult(res);
        loadHistory();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
        setLive(false);
      } finally {
        busyRef.current = false;
        setScanning(false);
      }
    },
    [zone, loadHistory]
  );

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      const shot = capture(720);
      if (shot) scan(shot);
    }, 2800);
    return () => clearInterval(timer);
  }, [live, capture, scan]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const dataUrl = await fileToDataUrl(files[0]);
    setLive(false);
    scan(dataUrl);
  };

  const chartData = history.map((h) => ({
    time: new Date(h.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    count: h.count,
  }));

  const peak = history.reduce((m, h) => Math.max(m, h.count), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Module 02 · Computer Vision"
        title="Crowd Analytics"
        description="YOLOv8 person detection estimates live occupancy in campus spaces. Every scan is logged for footfall trends."
        actions={
          <Badge tone="accent">
            <Radar className="h-3 w-3" /> YOLOv8n · CPU
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current zone" value={result?.count ?? "—"} hint={result ? `${zone} · latest scan` : "Run a scan"} icon={<Users className="h-4.5 w-4.5" />} tone="accent" />
        <StatCard label="Peak in window" value={peak} hint={`${history.length} recorded scans`} icon={<ScanLine className="h-4.5 w-4.5" />} />
        <StatCard label="Zones monitored" value={zones.length} hint="Latest sample per zone" icon={<MapPin className="h-4.5 w-4.5" />} tone="success" />
        <StatCard label="Detection model" value="YOLOv8n" hint="Class 0 · person · conf ≥ 0.35" icon={<Radar className="h-4.5 w-4.5" />} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Label>Zone</Label>
              <Select value={zone} onChange={(e) => setZone(e.target.value)}>
                {ZONES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </Select>
            </div>
            <Button
              variant={live ? "secondary" : "primary"}
              onClick={() => setLive((l) => !l)}
              className="mb-0.5"
            >
              {live ? <><CameraOff className="h-4 w-4" /> Stop live scan</> : <><Camera className="h-4 w-4" /> Live scan</>}
            </Button>
            <label className="mb-0.5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm text-slate-800 hover:border-zinc-600">
              <Upload className="h-4 w-4" /> Upload image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-line bg-black">
            <div className="relative aspect-video w-full">
              {result?.annotated ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.annotated} alt="Annotated crowd detection" className="h-full w-full object-contain" />
              ) : (
                <video ref={videoRef} className="h-full w-full object-cover opacity-90" playsInline muted />
              )}
              {!result?.annotated && !live && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0b11]">
                  <ImageUp className="h-7 w-7 text-slate-400" />
                  <p className="max-w-xs px-6 text-center text-xs text-slate-500">
                    Start a live scan or upload a photo of the library, canteen or corridor.
                  </p>
                </div>
              )}
              {scanning && (
                <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[10px] text-accent backdrop-blur">
                  <Spinner className="h-3 w-3" /> detecting people…
                </div>
              )}
              {result && (
                <div className="absolute bottom-3 left-3 rounded-lg border border-line/70 bg-black/70 px-3 py-1.5 text-[11px] text-slate-800 backdrop-blur">
                  <span className="font-semibold text-slate-900">{result.count}</span> people detected in {result.zone}
                </div>
              )}
            </div>
          </div>
          {live && !ready && <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-500"><Spinner className="h-3 w-3" /> Starting camera…</p>}
          {(error || camError) && (
            <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[11.5px] text-rose-700 dark:text-rose-300">
              {error || camError}
            </p>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-slate-400">
            <Radio className="h-3 w-3" /> Live mode samples one frame every 2.8s to keep CPU inference responsive.
          </p>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardTitle>Zone snapshot</CardTitle>
            <div className="mt-3 space-y-2">
              {zones.map((z) => (
                <button
                  key={z.zone}
                  onClick={() => setZone(z.zone)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition",
                    z.zone === zone ? "border-accent/40 bg-accent/[0.07]" : "border-line/70 bg-slate-50 hover:border-zinc-600"
                  )}
                >
                  <div>
                    <p className="text-[12px] text-slate-800">{z.zone}</p>
                    <p className="text-[10px] text-slate-400">{formatDateTime(z.created_at)}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                    {z.count}
                    <Users className="h-3 w-3 text-slate-500" />
                  </span>
                </button>
              ))}
              {zones.length === 0 && <p className="text-xs text-slate-500">No samples yet.</p>}
            </div>
          </Card>

          <Card>
            <CardTitle>Footfall · {zone}</CardTitle>
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="crowdFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1570ef" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#1570ef" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#1570ef", strokeOpacity: 0.25 }} />
                  <Area type="monotone" dataKey="count" stroke="var(--color-accent)" strokeWidth={2} fill="url(#crowdFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
