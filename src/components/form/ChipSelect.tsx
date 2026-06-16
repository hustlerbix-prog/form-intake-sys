export function ChipSelect(props: {
  options: { value: string; label: string }[];
  onSelect: (value: string, label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => props.onSelect(o.value, o.label)}
          className="px-4 py-2 rounded-full bg-navy-800 border border-navy-600 text-white hover:border-teal hover:bg-navy-600 transition"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

