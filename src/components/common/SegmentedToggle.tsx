import { YaggButton } from "./YaggButton";

interface SegmentedToggleOption {
  label: string;
  value: string;
}

interface SegmentedToggleProps {
  options: SegmentedToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
  role?: string;
  ariaLabel?: string;
}

export function SegmentedToggle({
  options,
  value,
  onChange,
  className = "flex gap-1",
  size = "sm",
  role = "menuitemradio",
  ariaLabel,
}: SegmentedToggleProps) {
  return (
    <div className={className} role={ariaLabel ? "group" : undefined} aria-label={ariaLabel}>
      {options.map((opt) => (
        <YaggButton
          key={opt.value}
          variant={value === opt.value ? "selection" : "outline"}
          size={size}
          className="text-2xs flex-1 capitalize"
          role={role}
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </YaggButton>
      ))}
    </div>
  );
}
