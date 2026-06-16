import { type ReactNode } from "react";

export function MessageBubble(props: {
  side: "agent" | "user";
  children: ReactNode;
}) {
  const isAgent = props.side === "agent";

  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div className={`flex items-end gap-3 max-w-[90%] ${isAgent ? "" : "flex-row-reverse"}`}>
        {isAgent ? (
          <div className="w-8 h-8 rounded-full bg-teal text-navy font-bold flex items-center justify-center flex-shrink-0">
            RA
          </div>
        ) : null}
        <div
          className={
            isAgent
              ? "bg-navy-800 text-white rounded-2xl rounded-bl-sm px-4 py-3"
              : "bg-navy-600 text-white rounded-2xl rounded-br-sm px-4 py-3"
          }
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}
