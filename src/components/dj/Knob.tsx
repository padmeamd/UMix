import { useState } from "react";

interface KnobProps {
  label: string;
  defaultValue?: number; // 0-100
  color?: string;
}

export function Knob({ label, defaultValue = 60, color = "var(--neon-pink)" }: KnobProps) {
  const [val, setVal] = useState(defaultValue);
  const angle = (val / 100) * 270 - 135;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative h-20 w-20 sm:h-16 sm:w-16 rounded-full cursor-pointer select-none"
        style={{
          background: "radial-gradient(circle at 30% 30%, oklch(0.35 0.08 295), oklch(0.18 0.05 295))",
          boxShadow: `inset 0 -3px 8px oklch(0 0 0 / 0.6), 0 0 14px ${color}`,
        }}
        onWheel={(e) => {
          e.preventDefault();
          setVal((v) => Math.max(0, Math.min(100, v - Math.sign(e.deltaY) * 5)));
        }}
        onClick={() => setVal((v) => (v + 10) % 110)}
        role="slider"
        aria-label={label}
        aria-valuenow={val}
      >
        <div
          className="absolute left-1/2 top-1/2 h-7 w-1 -translate-x-1/2 -translate-y-full rounded-full"
          style={{
            background: color,
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            transformOrigin: "bottom center",
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
