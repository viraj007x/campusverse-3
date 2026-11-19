import { cn } from "@/lib/cn";

export { Button } from "./button";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-[13.5px] font-semibold tracking-tight text-slate-900", className)}>{children}</h3>;
}

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "brand" | "success" | "warn" | "danger" | "accent";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold",
        tone === "neutral" && "border-line bg-slate-50 text-slate-600",
        tone === "brand" && "border-brand/20 bg-brand/5 text-brand",
        tone === "success" && "border-success/20 bg-success/10 text-emerald-700 dark:text-emerald-300",
        tone === "warn" && "border-warn/25 bg-warn/10 text-amber-700 dark:text-amber-300",
        tone === "danger" && "border-danger/20 bg-danger/10 text-red-700 dark:text-red-300",
        tone === "accent" && "border-accent/20 bg-accent/10 text-blue-700 dark:text-blue-300",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-line-strong bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-line-strong bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-line-strong bg-white px-3 text-[13px] text-slate-900 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={cn("mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500", className)}>{children}</label>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand",
        className
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-slate-50/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <p className="text-[13.5px] font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "brand" | "accent" | "success" | "warn" | "danger";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand/5 text-brand",
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-emerald-600",
    warn: "bg-warn/10 text-amber-600",
    danger: "bg-danger/10 text-red-600",
  };
  return (
    <Card className="relative overflow-hidden !p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1.5 text-[24px] font-semibold leading-tight tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 truncate text-[11.5px] text-slate-500">{hint}</p>}
        </div>
        {icon && <div className={cn("rounded-md p-2", tones[tone])}>{icon}</div>}
      </div>
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
