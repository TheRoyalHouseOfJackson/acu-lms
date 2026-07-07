export function LogoMark({ className = "", size = 40 }: { className?: string; size?: number }) {
  // ACU monogram: an open book forming an "A", with a cross/flame flourish above.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Ambassadors Christian University"
      role="img"
    >
      <rect width="48" height="48" rx="10" fill="hsl(347 47% 33%)" />
      {/* Open book pages forming an A */}
      <path
        d="M24 10 L34 38 M24 10 L14 38 M18 30 H30"
        stroke="hsl(42 48% 59%)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* flame / spire above */}
      <path
        d="M24 10 V4 M20.5 6.5 H27.5"
        stroke="hsl(38 43% 94%)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className = "", showText = true, size = 40 }: { className?: string; showText?: boolean; size?: number }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} data-testid="link-logo">
      <LogoMark size={size} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-serif text-xl tracking-tight text-primary">Ambassadors</span>
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Christian University
          </span>
        </div>
      )}
    </div>
  );
}
