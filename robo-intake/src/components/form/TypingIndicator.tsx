export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-navy-800 rounded-2xl rounded-bl-sm w-fit">
      {[0, 150, 300].map((delay) => (
        <div
          key={delay}
          className="w-2 h-2 rounded-full bg-teal animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

