import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const userPrompt = (transcript: string, genre: string) => `transcript: "${transcript}"
genre: "${genre}"

Produce the remix track plan now.`;

const InputSchema = z.object({
  transcript: z.string().min(1).max(4000),
  genre: z.string().min(1).max(60),
});

export const generateRemix = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "LOVABLE_API_KEY not configured" };
    }

    const tool = {
      type: "function" as const,
      function: {
        name: "remix_concept",
        description: "Structured remix track plan",
        parameters: {
          type: "object",
          properties: {
            analysis: {
              type: "object",
              properties: {
                emotion: { type: "string", enum: ["sad", "happy", "angry", "confused", "romantic", "chaotic", "neutral"] },
                intensity: { type: "integer", minimum: 1, maximum: 10 },
                key_phrases: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
              },
              required: ["emotion", "intensity", "key_phrases"],
              additionalProperties: false,
            },
            style: {
              type: "object",
              properties: {
                genre: { type: "string" },
                bpm: { type: "integer" },
                key: { type: "string" },
                energy: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: ["genre", "bpm", "key", "energy"],
              additionalProperties: false,
            },
            structure: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  name: { type: "string", enum: ["intro", "build", "drop", "outro"] },
                  start_sec: { type: "integer" },
                  end_sec: { type: "integer" },
                  description: { type: "string" },
                },
                required: ["name", "start_sec", "end_sec", "description"],
                additionalProperties: false,
              },
            },
            vocal_processing: {
              type: "object",
              properties: {
                mode: { type: "string", enum: ["raw", "chopped", "pitched", "glitch"] },
                main_phrase: { type: "string" },
                pitch_shift: { type: "integer" },
                loop_pattern: { type: "string" },
                effects: {
                  type: "object",
                  properties: {
                    reverb: { type: "string", enum: ["none", "light", "medium", "heavy"] },
                    delay: { type: "string", enum: ["none", "light", "medium", "heavy"] },
                    distortion: { type: "boolean" },
                    stutter: { type: "boolean" },
                  },
                  required: ["reverb", "delay", "distortion", "stutter"],
                  additionalProperties: false,
                },
              },
              required: ["mode", "main_phrase", "pitch_shift", "loop_pattern", "effects"],
              additionalProperties: false,
            },
            instrumental_layers: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["drums", "bass", "pad", "lead", "fx"] },
                  pattern: { type: "string" },
                  intensity: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["type", "pattern", "intensity"],
                additionalProperties: false,
              },
            },
          },
          required: ["analysis", "style", "structure", "vocal_processing", "instrumental_layers"],
          additionalProperties: false,
        },
      },
    };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt(data.transcript, data.genre) },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "remix_concept" } },
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "Rate limit reached. Please try again in a moment." };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." };
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { ok: false as const, error: `AI gateway error (${res.status})` };
      }

      const json = await res.json();
      const call = json?.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) {
        return { ok: false as const, error: "No structured response from AI." };
      }
      const remix = JSON.parse(call.function.arguments);
      return { ok: true as const, remix };
    } catch (err) {
      console.error("generateRemix failed", err);
      return { ok: false as const, error: "Something went wrong generating your remix." };
    }
  });
