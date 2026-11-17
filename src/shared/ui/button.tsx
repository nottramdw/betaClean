import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";

const STYLE: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-card",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-danger text-white hover:bg-red-800 shadow-card",
  "danger-outline":
    "border border-red-300 bg-white text-danger hover:border-red-400 hover:bg-red-50",
};

type Props = ComponentProps<"button"> & {
  variant?: Variant;
  icon?: ReactNode;
};

export function Button({ variant = "secondary", icon, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${STYLE[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
