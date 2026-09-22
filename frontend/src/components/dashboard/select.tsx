import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DashboardSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className="dashboard-select-trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="dashboard-select-content" data-lenis-prevent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="min-h-11 rounded-xl px-3 pr-8"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
