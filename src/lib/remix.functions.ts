import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

const InputSchema = z.object({
  transcript: z.string().min(1).max(4000),
  genre: z.string().min(1).max(60),
});

export const generateRemix = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: data.transcript, genre: data.genre }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Backend error", res.status, text);
        return { ok: false as const, error: `Backend error (${res.status})` };
      }

      return res.json() as Promise<{ ok: true; remix: unknown } | { ok: false; error: string }>;
    } catch (err) {
      console.error("generateRemix failed", err);
      return { ok: false as const, error: "Could not reach the backend. Is the Java server running?" };
    }
  });
