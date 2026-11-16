export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`h-8 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
            option.value === value ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
