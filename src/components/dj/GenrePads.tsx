import { cn } from "@/lib/utils";

export const GENRES = [
  { id: "synthwave", label: "Synthwave", emoji: "🌅", grad: "var(--gradient-pad-2)" },
  { id: "lofi", label: "Lo-Fi", emoji: "🎧", grad: "var(--gradient-pad-4)" },
  { id: "house", label: "House", emoji: "🏠", grad: "var(--gradient-pad)" },
  { id: "trap", label: "Trap", emoji: "🔥", grad: "var(--gradient-pad-3)" },
  { id: "drum-and-bass", label: "DnB", emoji: "⚡", grad: "var(--gradient-pad-4)" },
  { id: "ambient", label: "Ambient", emoji: "🌌", grad: "var(--gradient-pad)" },
  { id: "techno", label: "Techno", emoji: "🤖", grad: "var(--gradient-pad-2)" },
  { id: "hyperpop", label: "Hyperpop", emoji: "💖", grad: "var(--gradient-pad-3)" },
];

interface GenrePadsProps {
  value: string;
  onChange: (v: string) => void;
}

export function GenrePads({ value, onChange }: GenrePadsProps) {
  return (
    // 2 columns on mobile → easier to tap; 4 on sm+ screens
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {GENRES.map((g) => {
        const active = value === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onChange(g.id)}
            className={cn(
              "group relative rounded-xl p-4 text-left transition-all duration-200",
              "border border-white/10 overflow-hidden min-h-[80px]",
              active
                ? "scale-[1.04] shadow-[var(--shadow-neon-pink)] border-white/40"
                : "hover:scale-[1.02] hover:border-white/30 opacity-80 hover:opacity-100"
            )}
            style={{ background: active ? g.grad : "oklch(0.22 0.07 290 / 0.6)" }}
          >
            {active && (
              <span className="absolute inset-0 opacity-40 blur-xl" style={{ background: g.grad }} />
            )}
            <div className="relative z-10 flex h-full flex-col justify-between gap-2">
              <span className="text-2xl leading-none">{g.emoji}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white drop-shadow">
                {g.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
