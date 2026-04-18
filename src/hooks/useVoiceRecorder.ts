import { useCallback, useEffect, useRef, useState } from "react";

// Lightweight wrapper around the Web Speech API for browser-side transcription.
// Falls back gracefully when unsupported.

type SR = any;

function getSpeechRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const start = useCallback(() => {
    setError(null);
    const SR = getSpeechRecognition();
    if (!SR) {
      setSupported(false);
      setError("Voice recording isn't supported in this browser. Try Chrome, or type your note below.");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setTranscript((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      setError(e?.error === "not-allowed" ? "Microphone permission denied." : `Voice error: ${e?.error ?? "unknown"}`);
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    try {
      rec.start();
      setRecording(true);
    } catch (err) {
      setError("Could not start recording.");
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return { recording, transcript, setTranscript, start, stop, reset, supported, error };
}
