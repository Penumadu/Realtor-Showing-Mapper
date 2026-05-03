import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  ? path.resolve(__dirname, "../../public")
  : path.resolve(__dirname, "dist/public");

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
                    root: path.resolve(__dirname, ".."),
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
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(__dirname),
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
