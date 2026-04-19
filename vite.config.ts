import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Отключаем Cloudflare-режим, чтобы билд был под Node (Render)
  cloudflare: false,

  vite: {
    preview: {
      // Разрешаем внешний доступ (иначе будет localhost-only)
      host: true,

      // Разрешаем ВСЕ хосты (иначе Render блокируется)
      allowedHosts: true,

      // (необязательно, но можно явно указать порт)
      // port: 4173,
    },
  },
});