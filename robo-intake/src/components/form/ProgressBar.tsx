export function ProgressBar(props: { value: number; max: number }) {
  const max = Math.max(1, props.max);
  const pct = Math.max(0, Math.min(100, Math.round((props.value / max) * 100)));

  return (
    <div className="w-full">
      <div className="h-2 w-full rounded-full bg-navy-600 overflow-hidden">
        <div className="h-full bg-teal transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

