const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";

export async function generateRemix(transcript: string, genre: string) {
  const res = await fetch(`${BACKEND_URL}/api/generate-remix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, genre }),
  });

  if (!res.ok) {
    return { ok: false as const, error: `Request failed (${res.status})` };
  }

  return res.json() as Promise<{ ok: true; remix: unknown } | { ok: false; error: string }>;
}
