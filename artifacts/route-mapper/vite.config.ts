import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT is only used by the dev/preview server — fallback to 3000 when not set
// (e.g. during Vercel's `vite build` step which doesn't need a port).
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// BASE_PATH controls the Vite `base` option. Defaults to "/" for Vercel.
const basePath = process.env.BASE_PATH ?? "/";

const isReplit = Boolean(process.env.REPL_ID);

// On Vercel (VERCEL=1), output directly to the repo-root "public/" directory
// so Vercel finds it without any extra copy step or dashboard configuration.
// On Replit, output to the standard dist/public path used by the artifact config.
const outDir = process.env.VERCEL
  ? path.resolve(import.meta.dirname, "../../public")
  : path.resolve(import.meta.dirname, "dist/public");

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    // Replit-specific plugins — only loaded inside a Replit environment
    ...(isReplit
      ? [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
          ...(process.env.NODE_ENV !== "production"
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer({
                    root: path.resolve(import.meta.dirname, ".."),
                  }),
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) =>
                  m.devBanner(),
                ),
              ]
            : []),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
