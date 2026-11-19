"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ImagePlus,
  MapPin,
  PackageSearch,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { API, api, fileUrl, timeAgo } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, CardTitle, Input, Label, PageHeader, Select, Spinner, Textarea } from "@/components/ui";

type Item = {
  id: number;
  kind: "lost" | "found";
  title: string;
  description: string;
  category: string;
  location: string;
  status: string;
  image_url: string | null;
  reporter_name: string;
  created_at: string;
};

type MatchItem = Item & { match_score: number };
type Detail = { item: Item; matches: MatchItem[] };

const CATEGORIES = ["Electronics", "ID Card", "Bag", "Bottle", "Books", "Keys", "Clothing", "Other"];

function ItemCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-line bg-surface text-left transition hover:border-brand/40"
    >
      <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-[#121420] to-[#0a0b12]">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(item.image_url)} alt={item.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PackageSearch className="h-8 w-8 text-slate-300" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <Badge tone={item.kind === "lost" ? "warn" : "success"}>{item.kind.toUpperCase()}</Badge>
          {item.status === "matched" && <Badge tone="brand">match found</Badge>}
          {item.status === "resolved" && <Badge tone="neutral">resolved</Badge>}
        </div>
      </div>
      <div className="p-3.5">
        <p className="truncate text-[13px] font-medium text-slate-900">{item.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.description || "No description"}</p>
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Tag className="h-2.5 w-2.5" /> {item.category}
          </span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </button>
  );
}

function DetailModal({ detail, onClose, onResolve }: { detail: Detail; onClose: () => void; onResolve: () => void }) {
  const { item, matches } = detail;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Badge tone={item.kind === "lost" ? "warn" : "success"}>{item.kind.toUpperCase()}</Badge>
            <Badge tone="neutral">{item.category}</Badge>
            {item.status !== "open" && <Badge tone="brand">{item.status}</Badge>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="max-h-64 overflow-hidden rounded-xl border border-line bg-black/40 sm:max-h-none">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(item.image_url)} alt={item.title} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center">
                  <PackageSearch className="h-8 w-8 text-slate-300" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{item.description || "No description provided."}</p>
              <div className="mt-3 space-y-1.5 text-[11.5px] text-slate-500">
                <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {item.location || "Location not specified"}</p>
                <p className="flex items-center gap-1.5"><Boxes className="h-3 w-3" /> Reported by {item.reporter_name}</p>
                <p>{timeAgo(item.created_at)}</p>
              </div>
              {item.status !== "resolved" && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={onResolve}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              <p className="text-[12px] font-medium text-slate-800">Visual matches via CLIP</p>
            </div>
            <div className="mt-2.5 space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line/70 bg-slate-50 p-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-black/40">
                    {m.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(m.image_url)} alt={m.title} className="h-full w-full object-cover" />
                    ) : (
                      <PackageSearch className="m-auto h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-slate-800">{m.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {m.kind.toUpperCase()} · {m.location || "unknown location"} · {timeAgo(m.created_at)}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${Math.min(100, (m.match_score / 0.9) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-brand">{(m.match_score * 100).toFixed(0)}%</span>
                </div>
              ))}
              {matches.length === 0 && (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11.5px] text-slate-500">
                  No visual match yet. New reports are checked automatically as they arrive.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LostFoundPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | "lost" | "found">("all");
  const [kind, setKind] = useState<"lost" | "found">("lost");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [matchPreview, setMatchPreview] = useState<MatchItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const query = filter === "all" ? "" : `?kind=${filter}`;
      setItems(await api<Item[]>(`/api/lost-found/items${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setMessage(null);
    setMatchPreview([]);
    setError("");
    const form = new FormData();
    form.set("kind", kind);
    form.set("title", title);
    form.set("description", description);
    form.set("category", category);
    form.set("location", location);
    if (photo) form.set("image", photo);
    try {
      const res = await fetch(`${API}/api/lost-found`, { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not create report");
      setMessage(data.matches.length ? `Report submitted — ${data.matches.length} likely match(es) found.` : "Report submitted and added to the visual index.");
      setMatchPreview(data.matches || []);
      setTitle("");
      setDescription("");
      setLocation("");
      setPhoto(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function openDetail(id: number) {
    setLoadingDetail(true);
    try {
      setDetail(await api<Detail>(`/api/lost-found/items/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load item");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function resolve() {
    if (!detail) return;
    try {
      await api(`/api/lost-found/items/${detail.item.id}/resolve`, { method: "POST" });
      setDetail(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Module 03 · Multimodal"
        title="Lost & Found"
        description="Report a missing or found item with a photo. CLIP image embeddings match new reports against the campus visual index."
        actions={<Badge tone="brand"><Sparkles className="h-3 w-3" /> CLIP ViT-B/32</Badge>}
      />

      {error && (
        <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardTitle>Create a report</CardTitle>
            <form onSubmit={submit} className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["lost", "found"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-[12.5px] transition",
                      kind === k
                        ? k === "lost"
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                          : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : "border-line bg-canvas text-slate-600 hover:border-zinc-600"
                    )}
                  >
                    I {k === "lost" ? "lost" : "found"} an item
                  </button>
                ))}
              </div>
              <div>
                <Label>Item title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Black Dell laptop bag" required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Colour, stickers, contents, identifiable marks…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Library, 2nd floor" />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-line bg-canvas px-3 py-3 text-[11.5px] text-slate-600 hover:border-brand/50">
                <ImagePlus className="h-4 w-4 text-brand" />
                {photo ? photo.name : "Attach a photo (enables visual matching)"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              </label>
              {preview && (
                <div className="overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="aspect-video w-full object-cover" />
                </div>
              )}
              <Button type="submit" className="w-full" loading={submitting} disabled={!title.trim()}>
                Submit report
              </Button>
            </form>

            {message && (
              <p className="mt-3 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-[11.5px] text-brand-strong">{message}</p>
            )}
            {matchPreview.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {matchPreview.map((m) => (
                  <button key={m.id} onClick={() => openDetail(m.id)} className="flex w-full items-center justify-between rounded-lg border border-line/70 bg-slate-50 px-3 py-2 text-left">
                    <span className="truncate text-[11.5px] text-slate-700">{m.title}</span>
                    <span className="font-mono text-[10.5px] text-emerald-700 dark:text-emerald-300">{(m.match_score * 100).toFixed(0)}%</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
          <p className="px-1 text-[10.5px] leading-relaxed text-slate-400">
            The Lost and Found desk is in Admin Block A-102, 9 AM – 5 PM. Unclaimed items are disposed of after 30 days.
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
              {(["all", "lost", "found"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12px] capitalize transition",
                    filter === f ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Search className="h-3 w-3" /> {items.length} reports
            </span>
          </div>

          {loadingDetail && (
            <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500"><Spinner className="h-3 w-3" /> Loading detail…</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={() => openDetail(item.id)} />
            ))}
          </div>
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
              <PackageSearch className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-600">No reports in this view yet.</p>
              <p className="mt-0.5 text-[11.5px] text-slate-400">Create one on the left to seed the visual index.</p>
            </div>
          )}
        </div>
      </div>

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} onResolve={resolve} />}
    </div>
  );
}
