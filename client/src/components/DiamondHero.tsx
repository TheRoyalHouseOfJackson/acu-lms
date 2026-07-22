import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Vertical padding: "lg" for landing hero, "md" for page banners */
  size?: "lg" | "md";
  className?: string;
};

/**
 * Diamond-cut prismatic hero backdrop.
 * Layers 7 radial gradients (plum, coral, gold, teal, burgundy, ember, focal bloom)
 * on a wine base, with a subtle 45°/-45° crosshatch to give a faceted-cut feel,
 * plus a vignette for focus and a fine star-field for texture.
 */
export function DiamondHero({ children, size = "lg", className = "" }: Props) {
  const pad =
    size === "lg"
      ? "py-24 sm:py-32"
      : "py-16 sm:py-20";

  return (
    <section className={`relative overflow-hidden border-b border-border ${className}`}>
      {/* Original wine gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(347_40%_24%)]" />
      {/* Subtle star-field texture (original) */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className={`relative mx-auto max-w-7xl px-4 sm:px-6 ${pad}`}>
        {children}
      </div>
    </section>
  );
}
