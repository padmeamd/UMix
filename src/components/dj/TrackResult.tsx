interface RemixData {
  analysis: {
    emotion: string;
    intensity: number;
    key_phrases: string[];
  };
  style: {
    genre: string;
    bpm: number;
    key: string;
    energy: string;
  };
  structure: Array<{
    name: string;
    start_sec: number;
    end_sec: number;
    description: string;
  }>;
  vocal_processing: {
    mode: string;
    main_phrase: string;
    pitch_shift: number;
    loop_pattern: string;
    effects: {
      reverb: string;
      delay: string;
      distortion: boolean;
      stutter: boolean;
    };
  };
  instrumental_layers: Array<{
    type: string;
    pattern: string;
    intensity: string;
  }>;
}

const SECTION_COLORS: Record<string, string> = {
  intro: "var(--neon-cyan)",
  build: "var(--neon-purple)",
  drop: "var(--neon-pink)",
  outro: "var(--neon-orange)",
};

export function TrackResult({ data }: { data: RemixData }) {
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Analysis */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="mb-3 text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
          Analysis
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {data.analysis.key_phrases.map((phrase, i) => (
            <span
              key={i}
              className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-sm font-semibold"
              style={{ color: "var(--neon-cyan)" }}
            >
              {phrase}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-foreground/70">
          <span>Emotion: <span className="capitalize font-semibold text-foreground">{data.analysis.emotion}</span></span>
          <span>Intensity: <span className="font-semibold text-foreground">{data.analysis.intensity}/10</span></span>
        </div>
      </div>

      {/* Style */}
      <div className="grid grid-cols-4 gap-3">
        <Stat label="BPM" value={String(data.style.bpm)} accent="var(--neon-pink)" />
        <Stat label="Key" value={data.style.key} accent="var(--neon-orange)" small />
        <Stat label="Energy" value={data.style.energy} accent="var(--neon-cyan)" small />
        <Stat label="Genre" value={data.style.genre} accent="var(--neon-purple)" small />
      </div>

      {/* Structure timeline */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="mb-4 text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
          Track Structure · 30s
        </h3>
        <div className="space-y-3">
          {data.structure.map((s) => (
            <div key={s.name} className="flex gap-4">
              <div className="flex w-24 shrink-0 flex-col">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: SECTION_COLORS[s.name] }}
                >
                  {s.name}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {s.start_sec}s – {s.end_sec}s
                </span>
              </div>
              <div className="flex-1 border-l border-white/10 pl-4">
                <p className="text-sm text-foreground">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vocal processing */}
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-3 text-xs font-mono uppercase tracking-[0.3em] text-[var(--neon-pink)]">
          Vocal Processing
        </h3>
        <p className="mb-2 text-sm text-foreground italic">"{data.vocal_processing.main_phrase}"</p>
        <div className="flex flex-wrap gap-4 text-xs text-foreground/70">
          <span>Mode: <span className="font-semibold text-foreground capitalize">{data.vocal_processing.mode}</span></span>
          <span>Pitch: <span className="font-semibold text-foreground">{data.vocal_processing.pitch_shift > 0 ? "+" : ""}{data.vocal_processing.pitch_shift} st</span></span>
          <span>Loop: <span className="font-semibold text-foreground">{data.vocal_processing.loop_pattern}</span></span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["reverb", "delay"] as const).map((fx) => (
            <span key={fx} className="rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-mono capitalize">
              {fx}: {data.vocal_processing.effects[fx]}
            </span>
          ))}
          {data.vocal_processing.effects.distortion && (
            <span className="rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-mono">distortion</span>
          )}
          {data.vocal_processing.effects.stutter && (
            <span className="rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-mono">stutter</span>
          )}
        </div>
      </div>

      {/* Instrumental layers */}
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="mb-3 text-xs font-mono uppercase tracking-[0.3em] text-[var(--neon-orange)]">
          Instrumental Layers
        </h3>
        <div className="space-y-2">
          {data.instrumental_layers.map((layer, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span
                className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-wide"
                style={{ color: "var(--neon-orange)" }}
              >
                {layer.type}
              </span>
              <span className="flex-1 text-foreground/80">{layer.pattern}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground capitalize">{layer.intensity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, small }: { label: string; value: string; accent: string; small?: boolean }) {
  return (
    <div className="glass-panel rounded-2xl p-4 text-center">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div
        className={small ? "mt-1 text-sm font-semibold capitalize" : "mt-1 text-3xl font-black"}
        style={{ color: accent, textShadow: `0 0 12px ${accent}` }}
      >
        {value}
      </div>
    </div>
  );
}
