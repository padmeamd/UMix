import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface MicButtonProps {
  recording: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function MicButton({ recording, onToggle, disabled }: MicButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={recording ? "Stop recording" : "Start recording"}
      className={cn(
        "group relative flex h-40 w-40 items-center justify-center rounded-full transition-all duration-300",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        recording
          ? "bg-[var(--gradient-pad-2)] animate-pulse-glow scale-105"
          : "bg-[var(--gradient-pad)] hover:scale-105 shadow-[var(--shadow-neon-pink)]"
      )}
      style={{
        background: recording ? "var(--gradient-pad-2)" : "var(--gradient-pad)",
      }}
    >
      <span className="absolute inset-0 rounded-full opacity-60 blur-xl"
            style={{ background: recording ? "var(--gradient-pad-2)" : "var(--gradient-pad)" }} />
      <span className="absolute inset-2 rounded-full border border-white/20" />
      <span className="absolute inset-6 rounded-full border border-white/10" />
      {recording ? (
        <Square className="relative z-10 h-12 w-12 text-white fill-white" />
      ) : (
        <Mic className="relative z-10 h-16 w-16 text-white" strokeWidth={2.2} />
      )}
      {recording && (
        <span className="absolute -bottom-8 text-xs font-mono uppercase tracking-[0.3em] text-[var(--neon-pink)]">
          ● rec
        </span>
      )}
    </button>
  );
}
