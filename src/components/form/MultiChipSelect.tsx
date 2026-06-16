import { useMemo, useState } from "react";

export function MultiChipSelect(props: {
  options: { value: string; label: string }[];
  onSubmit: (values: string[], labels: string[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedValues = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedLabels = useMemo(() => {
    const byValue = new Map(props.options.map((o) => [o.value, o.label] as const));
    return selectedValues.map((v) => byValue.get(v) ?? v);
  }, [props.options, selectedValues]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => {
          const isOn = Boolean(selected[o.value]);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setSelected((s) => ({ ...s, [o.value]: !s[o.value] }))}
              className={
                "px-4 py-2 rounded-full border transition " +
                (isOn
                  ? "bg-teal text-navy border-teal font-semibold"
                  : "bg-navy-800 text-white border-navy-600 hover:border-teal hover:bg-navy-600")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => props.onSubmit(selectedValues, selectedLabels)}
          disabled={selectedValues.length === 0}
          className={
            "rounded-lg px-6 h-11 font-bold transition " +
            (selectedValues.length === 0
              ? "bg-navy-600 text-slateText cursor-not-allowed"
              : "bg-teal text-navy hover:brightness-110")
          }
        >
          Continue
        </button>
      </div>
    </div>
  );
}

