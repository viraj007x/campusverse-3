import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brand-solid text-white shadow-sm hover:brightness-110",
        variant === "secondary" &&
          "border border-line-strong bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
        variant === "outline" && "border border-brand/30 bg-brand/5 text-brand hover:bg-brand/10",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        variant === "danger" && "border border-danger/20 bg-danger/10 text-danger hover:bg-danger/15",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9 px-4 text-[13px]",
        size === "lg" && "h-11 px-5 text-sm",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  );
}
