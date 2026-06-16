export function ProgressDots(props: { total: number; currentIndex: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: props.total }).map((_, i) => (
        <div
          key={i}
          className={
            "w-2 h-2 rounded-full transition-all " +
            (i < props.currentIndex
              ? "bg-teal"
              : i === props.currentIndex
                ? "bg-teal ring-2 ring-teal/30 scale-125"
                : "bg-navy-600")
          }
        />
      ))}
    </div>
  );
}

