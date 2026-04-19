// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Disable Cloudflare Workers build target so the output is a plain
  // Node.js server entry — required for non-Cloudflare hosts (Render, Railway, etc.)
  cloudflare: false,

  vite: {
    preview: {
      // Allow any external host (e.g. umixhack.onrender.com).
      // Vite 5 added DNS-rebinding protection that blocks non-localhost hosts
      // by default. In a Render container behind HTTPS this attack vector
      // does not apply, so 'all' is safe here.
      allowedHosts: ["all"],
    },
  },
});
