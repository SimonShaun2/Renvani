import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { readSanityEnv } from "./src/sanity/env";
import { schemaTypes } from "./src/sanity/schemas";

const env = readSanityEnv();

export default defineConfig({
  name: "renvani",
  title: "Renvani",
  basePath: "/studio",
  projectId: env?.projectId ?? "unconfigured",
  dataset: env?.dataset ?? "production",
  plugins: [structureTool()],
  schema: { types: schemaTypes }
});
