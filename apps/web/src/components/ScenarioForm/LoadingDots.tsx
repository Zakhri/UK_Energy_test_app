export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-soft-bounce" />
      <span
        className="h-1.5 w-1.5 rounded-full bg-white/90 animate-soft-bounce"
        style={{ animationDelay: '120ms' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-white/90 animate-soft-bounce"
        style={{ animationDelay: '240ms' }}
      />
    </span>
  );
}
