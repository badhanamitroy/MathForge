import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "dist");
const rootFiles = [
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
  "Coordinates_graph.html",
  "Equation.html",
  "Ogiveline.html",
  "Polygonal.html"
];

for (const file of rootFiles) {
  const source = resolve(projectRoot, file);
  if (!source.startsWith(projectRoot + "\\") && !source.startsWith(projectRoot + "/")) {
    throw new Error(`Refusing to copy a path outside the project: ${file}`);
  }
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
for (const file of rootFiles) {
  cpSync(resolve(projectRoot, file), resolve(outputDirectory, file));
}
cpSync(resolve(projectRoot, "assets"), resolve(outputDirectory, "assets"), { recursive: true });

// Preserve legacy font files in source/archives, but omit them from the
// deployable app shell now that all runtime typography uses bundled Noto.
for (const file of [
  "assets/fonts/kalpurush.ttf",
  "assets/bangla font/kalpurush.ttf",
  "assets/bangla font/kalpurush ANSI.ttf"
]) {
  rmSync(resolve(outputDirectory, file), { force: true });
}

console.log(`Prepared static Vercel output at ${outputDirectory}`);
