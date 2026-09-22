import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const isVercel = Boolean(process.env.VERCEL);

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Vercel: Nitro vercel preset → .vercel/output (Build Output API).
    // Local/Node: node-server → .output/server/index.mjs for `npm start`.
    command === "build" &&
      (isVercel
        ? nitro({ preset: "vercel" })
        : nitro({
            preset: "node-server",
            output: {
              dir: ".output",
              serverDir: ".output/server",
              publicDir: ".output/public",
            },
          })),
    react(),
  ],
}));
