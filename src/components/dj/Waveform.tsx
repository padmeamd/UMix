interface WaveformProps {
  active: boolean;
  bars?: number;
}

export function Waveform({ active, bars = 40 }: WaveformProps) {
  return (
    <div className="flex h-20 items-center justify-center gap-1 px-4">
      {Array.from({ length: bars }).map((_, i) => {
        const h = active ? 30 + Math.sin(i * 0.6) * 30 + Math.random() * 30 : 8;
        return (
          <span
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${h}%`,
              background: "var(--gradient-text)",
              animation: active ? `wave 1.2s ease-in-out ${i * 0.04}s infinite` : "none",
              opacity: active ? 1 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
}
