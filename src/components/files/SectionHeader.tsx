import type { ReactNode } from "react";
import { YaggButton } from "../common/YaggButton";

const SECTION_ACTION_BTN_CLASS =
  "section-action-btn border-border text-text-muted hover:border-text-muted hover:bg-bg-hover inline-flex h-6 items-center gap-1 bg-transparent px-2 text-xs disabled:cursor-not-allowed";

interface SectionHeaderProps {
  title: string;
  count: number;
  hint?: string;
  actions?: ReactNode;
}

export function SectionHeader({ title, count, hint, actions }: SectionHeaderProps) {
  return (
    <div className="section-header border-border bg-bg-well text-text-muted flex shrink-0 flex-col items-start border-b px-3 py-1 text-xs">
      <div className="section-header-title flex w-full items-center gap-2">
        <span className="section-title font-medium">{title}</span>
        {hint && <span className="text-text-muted ml-1 text-xs">{hint}</span>}
        <span className="section-count bg-bg-hover ml-auto rounded-full px-1.5 py-px text-xs">
          {count}
        </span>
      </div>
      {actions && (
        <div className="section-actions mt-1 flex min-h-6 items-center gap-1">{actions}</div>
      )}
    </div>
  );
}

interface SectionActionButtonProps {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
  disabled?: boolean;
}

export function SectionActionButton({
  onClick,
  title,
  ariaLabel,
  children,
  disabled,
}: SectionActionButtonProps) {
  return (
    <YaggButton
      className={SECTION_ACTION_BTN_CLASS}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </YaggButton>
  );
}
