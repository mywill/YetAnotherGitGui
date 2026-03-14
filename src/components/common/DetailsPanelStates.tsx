import clsx from "clsx";

interface DetailsPanelStateProps {
  className: string;
  label: string;
}

export function DetailsPanelLoading({ className, label }: DetailsPanelStateProps) {
  return (
    <div
      className={clsx(
        className,
        "loading text-text-muted flex h-full flex-col items-center justify-center gap-3"
      )}
    >
      <div className="loading-spinner" />
      <span>{label}</span>
    </div>
  );
}

export function DetailsPanelEmpty({ className, label }: DetailsPanelStateProps) {
  return (
    <div
      className={clsx(
        className,
        "empty text-text-muted flex h-full flex-col items-center justify-center"
      )}
    >
      <p>{label}</p>
    </div>
  );
}
