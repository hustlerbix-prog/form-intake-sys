import { useEffect, useMemo, useRef, useState } from "react";

export function FreeTextInput(props: { onSubmit: (value: string) => void; placeholder?: string }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => value.trim().length > 0, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 5 * 24)}px`;
  }, [value]);

  return (
    <div className="flex gap-3 items-end">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={props.placeholder ?? "Type your answer..."}
        className="w-full resize-none bg-navy-800 border border-navy-600 rounded-lg px-4 py-3 text-white placeholder:text-slateText focus:outline-none focus:ring-2 focus:ring-teal/30"
        rows={1}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!canSend) return;
            const toSend = value.trim();
            setValue("");
            props.onSubmit(toSend);
          }
        }}
      />
      <button
        type="button"
        disabled={!canSend}
        onClick={() => {
          if (!canSend) return;
          const toSend = value.trim();
          setValue("");
          props.onSubmit(toSend);
        }}
        className={
          "rounded-lg px-5 h-11 font-bold transition " +
          (canSend ? "bg-teal text-navy hover:brightness-110" : "bg-navy-600 text-slateText cursor-not-allowed")
        }
      >
        Send
      </button>
    </div>
  );
}

