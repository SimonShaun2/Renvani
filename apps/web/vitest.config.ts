import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/*.{test,spec}.tsx", "happy-dom"]],
    deps: {
      optimizer: {
        web: {
          include: ["happy-dom", "@testing-library/react", "@testing-library/dom"]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url))
    }
  }
});
