"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 " +
  "disabled:opacity-40 disabled:pointer-events-none select-none active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-lapis text-white hover:bg-lapis-deep shadow-[0_1px_2px_rgba(30,53,99,0.25)]",
  secondary: "bg-surface text-ink border border-line hover:border-ink-faint",
  ghost: "text-lapis hover:bg-lapis-soft",
  danger: "bg-surface text-danger border border-line hover:border-danger",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-[17px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});
