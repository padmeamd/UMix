import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AI_GATEWAY_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You are an AI music producer system that generates structured remix track plans.
Your output will be consumed by a backend service.
You MUST follow all formatting rules strictly.
RULES:
- Output ONLY valid JSON
- Do NOT include explanations, comments, markdown, or text outside JSON
- All fields are REQUIRED
- Use consistent units (seconds, BPM, semitones)
- Keep values simple and programmatically usable
- If unsure, choose a reasonable default`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "remix_concept",
    description: "Structured remix track plan",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["analysis", "style", "structure", "vocal_processing", "instrumental_layers"],
      properties: {
        analysis: {
          type: "object",
          additionalProperties: false,
          required: ["emotion", "intensity", "key_phrases"],
          properties: {
            emotion: { type: "string", enum: ["sad","happy","angry","confused","romantic","chaotic","neutral"] },
            intensity: { type: "integer", minimum: 1, maximum: 10 },
            key_phrases: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
          },
        },
        style: {
          type: "object",
          additionalProperties: false,
          required: ["genre", "bpm", "key", "energy"],
          properties: {
            genre: { type: "string" },
            bpm: { type: "integer" },
            key: { type: "string" },
            energy: { type: "string", enum: ["low","medium","high"] },
          },
        },
        structure: {
          type: "array", minItems: 4, maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "start_sec", "end_sec", "description"],
            properties: {
              name: { type: "string", enum: ["intro","build","drop","outro"] },
              start_sec: { type: "integer" },
              end_sec: { type: "integer" },
              description: { type: "string" },
            },
          },
        },
        vocal_processing: {
          type: "object",
          additionalProperties: false,
          required: ["mode", "main_phrase", "pitch_shift", "loop_pattern", "effects"],
          properties: {
            mode: { type: "string", enum: ["raw","chopped","pitched","glitch"] },
            main_phrase: { type: "string" },
            pitch_shift: { type: "integer" },
            loop_pattern: { type: "string" },
            effects: {
              type: "object",
              additionalProperties: false,
              required: ["reverb", "delay", "distortion", "stutter"],
              properties: {
                reverb: { type: "string", enum: ["none","light","medium","heavy"] },
                delay: { type: "string", enum: ["none","light","medium","heavy"] },
                distortion: { type: "boolean" },
                stutter: { type: "boolean" },
              },
            },
          },
        },
        instrumental_layers: {
          type: "array", minItems: 3, maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "pattern", "intensity"],
            properties: {
              type: { type: "string", enum: ["drums","bass","pad","lead","fx"] },
              pattern: { type: "string" },
              intensity: { type: "string", enum: ["low","medium","high"] },
            },
          },
        },
      },
    },
  },
};

// Genre-based defaults used when no API key is configured or AI call fails
function localRemix(genre: string) {
  const g = genre.toLowerCase().replace(/\s+/g, "-");
  const bpmMap: Record<string, number> = {
    synthwave: 120, lofi: 75, house: 128, trap: 140,
    "drum-and-bass": 174, ambient: 90, techno: 135, hyperpop: 160,
  };
  const energyMap: Record<string, "low" | "medium" | "high"> = {
    ambient: "low", lofi: "low", synthwave: "medium",
    house: "high", trap: "high", techno: "high",
    "drum-and-bass": "high", hyperpop: "high",
  };
  return {
    ok: true as const,
    remix: {
      analysis: { emotion: "neutral", intensity: 7, key_phrases: ["voice drop", genre] },
      style: { genre, bpm: bpmMap[g] ?? 120, key: "C minor", energy: energyMap[g] ?? "high" },
      structure: [
        { name: "intro",  start_sec: 0,  end_sec: 3,  description: "Intro with hi-hats" },
        { name: "build",  start_sec: 3,  end_sec: 5,  description: "Riser build-up" },
        { name: "drop",   start_sec: 5,  end_sec: 25, description: "Main drop — voice chops layer in" },
        { name: "outro",  start_sec: 25, end_sec: 30, description: "Fade out" },
      ],
      vocal_processing: {
        mode: "chopped",
        main_phrase: "voice drop",
        pitch_shift: 0,
        loop_pattern: "2-bar",
        effects: { reverb: "medium", delay: "light", distortion: false, stutter: true },
      },
      instrumental_layers: [
        { type: "drums", pattern: "kick-snare groove", intensity: "high" },
        { type: "bass",  pattern: "syncopated bassline", intensity: "high" },
        { type: "pad",   pattern: "sustained chords", intensity: "medium" },
      ],
    },
  };
}

const InputSchema = z.object({
  transcript: z.string().min(1).max(4000),
  genre: z.string().min(1).max(60),
});

export const generateRemix = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.UMIX_API_KEY;

    // No API key — use local genre-based metadata so the beat always plays
    if (!apiKey) {
      return localRemix(data.genre);
    }

    try {
      const userMessage = `transcript: "${data.transcript}"\ngenre: "${data.genre}"\n\nProduce the remix track plan now.`;

      const res = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "remix_concept" } },
        }),
      });

      if (res.status === 429) return { ok: false as const, error: "Rate limit reached. Please try again in a moment." };
      if (res.status === 402) return { ok: false as const, error: "AI credits exhausted." };
      if (!res.ok) {
        console.error("AI gateway error", res.status, await res.text().catch(() => ""));
        return localRemix(data.genre); // degrade gracefully
      }

      const json = await res.json();
      const argsStr = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return localRemix(data.genre);

      const remix = JSON.parse(argsStr);
      return { ok: true as const, remix };
    } catch (err) {
      console.error("generateRemix failed", err);
      return localRemix(data.genre);
    }
  });
