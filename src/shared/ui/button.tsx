import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";

const STYLE: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-danger text-white hover:bg-red-800 shadow-sm",
  "danger-outline": "border border-red-300 bg-white text-danger hover:bg-red-50",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: ReactNode;
};

export function Button({ variant = "secondary", icon, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${STYLE[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
