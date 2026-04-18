import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Disc3, Sparkles, Loader2, Play, Square } from "lucide-react";
import { BeatPlayer } from "@/lib/beatPlayer";
import { MicButton } from "@/components/dj/MicButton";
import { GenrePads, GENRES } from "@/components/dj/GenrePads";
import { Waveform } from "@/components/dj/Waveform";
import { Knob } from "@/components/dj/Knob";
import { TrackResult } from "@/components/dj/TrackResult";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { generateRemix } from "@/lib/remix.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voice DJ Booth — Turn Your Voice Into a Remix" },
      {
        name: "description",
        content:
          "Record a voice note, pick a genre, and watch an AI producer drop a 30-second remix concept inside a neon synthwave DJ booth.",
      },
      { property: "og:title", content: "Voice DJ Booth — AI Remix Studio" },
      { property: "og:description", content: "Your voice. Your beat. Your moment on stage." },
    ],
  }),
  component: Index,
});

function Index() {
  const recorder = useVoiceRecorder();
  const [genre, setGenre] = useState("synthwave");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remix, setRemix] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<BeatPlayer | null>(null);
  useEffect(() => () => playerRef.current?.stop(), []);

  const onGenerate = async () => {
    setError(null);
    setRemix(null);
    playerRef.current?.stop();
    setPlaying(false);
    const text = recorder.transcript.trim();
    if (!text) {
      setError("Record or type a voice note first.");
      return;
    }
    setLoading(true);
    try {
      const genreLabel = GENRES.find((g) => g.id === genre)?.label ?? genre;
      const result = await generateRemix(text, genreLabel);
      if (result.ok) setRemix(result.remix);
      else setError(result.error);
    } catch (e) {
      setError("Failed to generate remix.");
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!remix) return;
    if (playing) {
      playerRef.current?.stop();
      setPlaying(false);
      return;
    }
    if (!playerRef.current) playerRef.current = new BeatPlayer();
    setPlaying(true);
    await playerRef.current.play(
      {
        bpm: remix.style?.bpm ?? 120,
        genre,
        energy: remix.style?.energy ?? "medium",
        durationSec: 30,
      },
      () => setPlaying(false),
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Sunset sky background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-sky)", opacity: 0.4 }}
      />
      {/* Sun */}
      <div
        className="pointer-events-none absolute left-1/2 top-[8%] -z-10 h-72 w-72 -translate-x-1/2 rounded-full blur-2xl"
        style={{ background: "var(--gradient-sunset)", opacity: 0.7 }}
      />
      {/* Grid floor */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[55vh] synth-grid" />

      <main className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        {/* Header */}
        <header className="mb-10 text-center animate-fade-up">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 backdrop-blur">
            <Disc3 className="h-4 w-4 animate-spin-slow text-[var(--neon-pink)]" />
            <span className="text-xs font-mono uppercase tracking-[0.3em] text-foreground/80">
              Voice DJ Booth
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-gradient-sunset">
            Drop the Beat
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-foreground/70">
            Speak your mood. Pick a genre. Watch your voice become a 30-second remix.
          </p>
        </header>

        {/* Booth */}
        <section className="glass-panel rounded-3xl p-6 md:p-10 animate-fade-up">
          <div className="grid gap-10 md:grid-cols-[auto_1fr] md:items-center">
            {/* Mic + waveform */}
            <div className="flex flex-col items-center gap-6">
              <MicButton
                recording={recorder.recording}
                onToggle={recorder.recording ? recorder.stop : recorder.start}
                disabled={loading}
              />
              <div className="flex items-end gap-3">
                <Knob label="Gain" defaultValue={70} color="var(--neon-pink)" />
                <Knob label="Reverb" defaultValue={45} color="var(--neon-orange)" />
                <Knob label="FX" defaultValue={60} color="var(--neon-cyan)" />
              </div>
            </div>

            {/* Right side */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                    Voice Input
                  </span>
                  {recorder.transcript && (
                    <button
                      onClick={recorder.reset}
                      className="text-[10px] font-mono uppercase tracking-widest text-[var(--neon-pink)] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Waveform active={recorder.recording} />
                <textarea
                  value={recorder.transcript}
                  onChange={(e) => recorder.setTranscript(e.target.value)}
                  placeholder={recorder.supported
                    ? "Tap the mic and speak — or type your vibe here…"
                    : "Voice not supported in this browser. Type your vibe here…"}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg bg-transparent p-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
                {recorder.error && (
                  <p className="mt-1 text-xs text-destructive">{recorder.error}</p>
                )}
              </div>

              <div>
                <span className="mb-3 block text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
                  Genre Pads
                </span>
                <GenrePads value={genre} onChange={setGenre} />
              </div>

              {/* Generate */}
              <button
                onClick={onGenerate}
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl py-5 text-lg font-black uppercase tracking-[0.25em] text-white transition-all duration-300 hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "var(--gradient-pad-2)", boxShadow: "var(--shadow-neon-pink)" }}
              >
                <span className="absolute inset-0 -z-0 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: "var(--gradient-pad-3)" }} />
                <span className="relative z-10 inline-flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Cooking the drop…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Drop the Beat
                    </>
                  )}
                </span>
                <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/20 animate-scan" />
              </button>

              {error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Result */}
        {remix && (
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Disc3 className={`h-6 w-6 text-[var(--neon-pink)] ${playing ? "animate-spin" : "animate-spin-slow"}`} />
                <h2 className="text-2xl font-black uppercase tracking-widest text-gradient-sunset">
                  Your Remix
                </h2>
              </div>
              <button
                onClick={togglePlay}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-black uppercase tracking-[0.25em] text-white transition-all duration-300 hover:scale-[1.04]"
                style={{
                  background: playing ? "var(--gradient-pad-3)" : "var(--gradient-pad-2)",
                  boxShadow: "var(--shadow-neon-pink)",
                }}
              >
                {playing ? (
                  <>
                    <Square className="h-4 w-4 fill-white" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    Play the Track
                  </>
                )}
                {playing && (
                  <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/20 animate-scan" />
                )}
              </button>
            </div>
            <TrackResult data={remix} />
          </section>
        )}

        <footer className="mt-16 text-center text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
          🎚 Powered by Lovable AI · Synthwave Edition
        </footer>
      </main>
    </div>
  );
}
