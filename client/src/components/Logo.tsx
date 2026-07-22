import crestUrl from "@assets/acu-crest.png";

export function LogoMark({
  className = "",
  size = 48,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={crestUrl}
      width={size}
      height={size}
      alt="Ambassadors Christian University crest"
      className={`select-none object-contain ${className}`}
      draggable={false}
      style={{ width: size, height: size }}
    />
  );
}

export function Logo({
  className = "",
  showText = false,
  size = 73,
  tone = "dark",
}: {
  className?: string;
  /** The crest already contains the wordmark. Only enable text for very small marks. */
  showText?: boolean;
  size?: number;
  /**
   * "dark" (default): render the crest as-is on light backgrounds.
   * "light": invert the crest to white so it reads on dark backgrounds (sidebar, footer).
   */
  tone?: "dark" | "light";
}) {
  const filter = tone === "light" ? "[filter:brightness(0)_invert(1)]" : "";
  return (
    <div className={`flex items-center gap-3 ${className}`} data-testid="link-logo">
      <LogoMark size={size} className={filter} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-serif text-xl tracking-tight ${tone === "light" ? "text-background" : "text-primary"}`}>
            Ambassadors
          </span>
          <span className={`text-[0.65rem] uppercase tracking-[0.2em] font-medium ${tone === "light" ? "text-background/70" : "text-muted-foreground"}`}>
            Christian University
          </span>
        </div>
      )}
    </div>
  );
}
