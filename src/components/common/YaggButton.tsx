import { forwardRef } from "react";
import clsx from "clsx";

type YaggButtonVariant =
  | "default"
  | "outline"
  | "primary"
  | "ghost"
  | "accent"
  | "menu-item"
  | "selection"
  | "text-link"
  | "icon"
  | "tab";

type YaggButtonSize = "sm" | "md";

interface YaggButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: YaggButtonVariant;
  size?: YaggButtonSize;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean | "true" | "false" | "menu" | "listbox" | "tree" | "grid" | "dialog";
  "aria-selected"?: boolean;
}

const variantClasses: Record<YaggButtonVariant, string> = {
  default:
    "bg-bg-tertiary border border-border text-text-primary rounded cursor-pointer hover:bg-bg-hover transition-colors duration-150",
  outline:
    "bg-transparent border border-border text-text-secondary rounded cursor-pointer hover:bg-bg-hover hover:text-text-primary transition-all duration-150",
  primary:
    "bg-bg-selected border border-bg-selected text-white rounded cursor-pointer hover:bg-bg-selected-hover transition-all duration-150",
  ghost:
    "bg-bg-secondary border border-border text-text-secondary rounded cursor-pointer hover:bg-bg-hover transition-colors duration-150",
  accent:
    "bg-accent border-none text-white rounded cursor-pointer hover:opacity-90 transition-opacity duration-150",
  "menu-item":
    "block w-full bg-transparent border-none text-left text-text-primary cursor-pointer hover:bg-bg-hover transition-colors duration-100",
  selection:
    "bg-primary border-none text-white rounded cursor-pointer hover:bg-primary-hover transition-colors duration-100",
  "text-link":
    "bg-transparent border-none text-primary cursor-pointer hover:text-primary/80 font-medium",
  icon: "bg-bg-tertiary border border-border text-text-primary rounded cursor-pointer hover:bg-bg-hover p-1 transition-colors duration-150",
  tab: "bg-transparent border border-transparent text-text-secondary rounded cursor-pointer hover:bg-bg-hover hover:text-text-primary transition-all duration-150",
};

const sizeClasses: Record<YaggButtonSize, string> = {
  sm: "px-2 py-0.5 text-xs min-h-[24px]",
  md: "px-3 py-1.5 text-xs min-h-[28px]",
};

// Variants that should not get size classes (they have their own layout)
const skipSizeVariants = new Set<YaggButtonVariant>(["menu-item", "text-link", "icon", "tab"]);

export const YaggButton = forwardRef<HTMLButtonElement, YaggButtonProps>(function YaggButton(
  {
    variant = "default",
    size = "sm",
    disabled = false,
    onClick,
    children,
    className,
    role,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      role={role}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center select-none",
        variantClasses[variant],
        !skipSizeVariants.has(variant) && sizeClasses[size],
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
