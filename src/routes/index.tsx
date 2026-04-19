import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Disc3, Sparkles, Loader2, Play, Square, Download } from "lucide-react";
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
      { title: "UMix — Turn Your Voice Into a Remix" },
      {
        name: "description",
        content: "Record your voice, pick a genre, and hear it chopped and remixed into a 30-second banger.",
      },
      { property: "og:title", content: "UMix — AI Remix Studio" },
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
  const [previewing, setPreviewing] = useState(false);
  const [autotune, setAutotune] = useState(false);
  // Keep the voice blob alive even if the user re-records before playback
  const [capturedVoice, setCapturedVoice] = useState<Blob | null>(null);
  const [mixBlob, setMixBlob] = useState<Blob | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const playerRef = useRef<BeatPlayer | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const generate = useServerFn(generateRemix);

  // Detect file-sharing capability on the client (never runs on server)
  useEffect(() => {
    try {
      const probe = new File(["x"], "probe.webm", { type: "audio/webm" });
      setCanNativeShare(
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [probe] })
      );
    } catch {
      setCanNativeShare(false);
    }
  }, []);

  // Clean up preview audio and object URL on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      previewAudioRef.current?.pause();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const togglePreview = () => {
    if (previewing) {
      previewAudioRef.current?.pause();
      setPreviewing(false);
      return;
    }
    if (!recorder.audioBlob) return;

    // Revoke previous URL if any
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(recorder.audioBlob);
    previewUrlRef.current = url;

    const audio = new Audio(url);
    previewAudioRef.current = audio;
    audio.onended = () => setPreviewing(false);
    audio.play();
    setPreviewing(true);
  };

  // Stop preview if user re-records
  const handleReRecord = () => {
    previewAudioRef.current?.pause();
    setPreviewing(false);
    recorder.reset();
  };

  const getMixFile = () => {
    if (!mixBlob) return null;
    const ext = mixBlob.type.includes("ogg") ? "ogg" : "webm";
    return new File([mixBlob], `voice-drop-mix.${ext}`, { type: mixBlob.type });
  };

  const downloadMix = () => {
    const file = getMixFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareToWhatsApp = async () => {
    const file = getMixFile();
    if (!file) return;

    if (canNativeShare) {
      // Mobile — opens the native OS share sheet (WhatsApp appears in the list)
      try {
        await navigator.share({
          files: [file],
          title: "My Voice Drop Mix",
          text: "Check out this remix I just made!",
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return; // user dismissed — do nothing
        // unexpected error — fall through to download
      }
    }

    // Desktop fallback: download the file so the user can attach it in WhatsApp Web
    downloadMix();
  };

  const onGenerate = async () => {
    setError(null);
    setRemix(null);
    playerRef.current?.stop();
    setPlaying(false);

    if (!recorder.audioBlob) {
      setError("Tap the mic and record your voice sample first!");
      return;
    }

    setCapturedVoice(recorder.audioBlob);
    setLoading(true);
    try {
      const genreLabel = GENRES.find((g) => g.id === genre)?.label ?? genre;
      // Send genre as the creative brief — the voice audio drives the actual sound
      const result = await generate({ data: { transcript: `voice drop in ${genreLabel} style`, genre: genreLabel } });
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
    setMixBlob(null); // clear previous mix while recording a new one
    setPlaying(true);
    await playerRef.current.play(
      {
        bpm: remix.style?.bpm ?? 120,
        genre,
        energy: remix.style?.energy ?? "medium",
        durationSec: 30,
        voiceBlob: capturedVoice ?? undefined,
        autotune,
        autotuneScale: "minor",
      },
      () => setPlaying(false),
      (blob) => setMixBlob(blob),
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

      <main className="mx-auto max-w-5xl px-4 py-6 md:py-16">
        {/* Header */}
        <header className="mb-6 md:mb-10 text-center animate-fade-up">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 backdrop-blur">
            <Disc3 className="h-4 w-4 animate-spin-slow text-[var(--neon-pink)]" />
            <span className="text-xs font-mono uppercase tracking-[0.3em] text-foreground/80">
              UMix
            </span>
          </div>
          <h1 className="text-4xl md:text-7xl font-black tracking-tight text-gradient-sunset">
            Drop the Beat
          </h1>
          <p className="mx-auto mt-2 md:mt-3 max-w-xl text-sm md:text-base text-foreground/70">
            Record your voice. Pick a genre. Hear it chopped, looped and remixed into a 30-second banger.
          </p>
        </header>

        {/* Booth */}
        <section className="glass-panel rounded-3xl p-4 md:p-10 animate-fade-up">
          <div className="grid gap-6 md:gap-10 md:grid-cols-[auto_1fr] md:items-center">
            {/* Mic + waveform */}
            <div className="flex flex-col items-center gap-4 md:gap-6">
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
                    Voice Sample
                  </span>
                  {recorder.audioBlob && !recorder.recording && (
                    <button
                      onClick={handleReRecord}
                      className="min-h-[44px] px-3 text-xs font-mono uppercase tracking-widest text-[var(--neon-pink)] hover:underline"
                    >
                      Re-record
                    </button>
                  )}
                </div>
                <Waveform active={recorder.recording} />
                <div className="mt-2 px-1 py-1 text-sm">
                  {recorder.recording ? (
                    <span className="font-mono text-[var(--neon-pink)] animate-pulse">
                      ● Recording… {recorder.duration}s — tap mic to stop
                    </span>
                  ) : recorder.audioBlob ? (
                    <div className="flex flex-col gap-3">
                      {/* Status + Listen on one row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm text-[var(--neon-cyan)]">
                          ✓ Captured ({recorder.duration}s)
                        </span>
                        <button
                          onClick={togglePreview}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95"
                          style={{
                            background: previewing ? "var(--gradient-pad-3)" : "var(--gradient-pad-2)",
                            boxShadow: "var(--shadow-neon-pink)",
                          }}
                        >
                          {previewing ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-white" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-white" />
                              Listen
                            </>
                          )}
                        </button>
                      </div>

                      {/* Autotune toggle — full-width on mobile for easy tap */}
                      <button
                        onClick={() => setAutotune((v) => !v)}
                        className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                        style={
                          autotune
                            ? {
                                background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                                boxShadow: "0 0 14px #a855f780",
                                color: "#fff",
                              }
                            : {
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: "rgba(255,255,255,0.5)",
                              }
                        }
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12 Q5 4 8 12 Q11 20 14 12 Q17 4 20 12 Q21.5 16 22 12" />
                        </svg>
                        Autotune {autotune ? "On" : "Off"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60">
                      Tap the mic to record your voice sample
                    </span>
                  )}
                </div>
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
          <section className="mt-6 md:mt-10">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <Disc3 className={`h-6 w-6 text-[var(--neon-pink)] ${playing ? "animate-spin" : "animate-spin-slow"}`} />
                <h2 className="text-2xl font-black uppercase tracking-widest text-gradient-sunset">
                  Your Remix
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="group relative inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-black uppercase tracking-[0.25em] text-white transition-all duration-300 hover:scale-[1.04]"
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

                {/* Save / Share buttons — appear once recording is captured */}
                {playing ? (
                  <span className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/50 border border-white/10">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording…
                  </span>
                ) : mixBlob ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Save — always downloads */}
                    <button
                      onClick={downloadMix}
                      title="Download mix as audio file"
                      className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-all duration-300 hover:scale-[1.04] border border-white/20 bg-white/10 backdrop-blur hover:bg-white/20"
                    >
                      <Download className="h-4 w-4" />
                      Save
                    </button>

                    {/* WhatsApp — native share on mobile, download on desktop */}
                    <button
                      onClick={shareToWhatsApp}
                      title={canNativeShare ? "Send to WhatsApp" : "Download to send via WhatsApp"}
                      className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-all duration-300 hover:scale-[1.04]"
                      style={{
                        background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                        boxShadow: "0 0 16px #25D36670",
                      }}
                    >
                      {/* WhatsApp logo SVG */}
                      <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <TrackResult data={remix} />
          </section>
        )}

        <footer className="mt-16 text-center text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
          🎚 UMix · Synthwave Edition
        </footer>
      </main>
    </div>
  );
}
