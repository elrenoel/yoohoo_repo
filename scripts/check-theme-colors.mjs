import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "src");
const allowedExtensions = new Set([".css", ".ts", ".tsx"]);
const allowedFiles = new Set([
  "app/globals.css",
  "lib/deck-card-colors.ts",
  "lib/theme-tokens.ts",
]);

const rawHex = /#[\da-f]{3,8}\b/gi;
const builtInTailwindColor = /(?:^|[^\w-])(?:[\w-]+:)*(?:accent|bg|border|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)-(?:amber|black|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|white|yellow|zinc)(?:-(?:50|[1-9]00))?(?:\/\d{1,3})?(?=[^\w-]|$)/g;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return allowedExtensions.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const file of await sourceFiles(root)) {
  const name = relative(root, file).split(sep).join("/");
  if (allowedFiles.has(name) || name.startsWith("components/flashcard/")) continue;

  const source = await readFile(file, "utf8");
  for (const [label, pattern] of [["raw hex", rawHex], ["Tailwind built-in color", builtInTailwindColor]]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${name}:${line} ${label}: ${match[0].trim()}`);
    }
  }
}

if (violations.length) {
  console.error("Theme color policy failed. Use semantic dark-theme tokens instead:\n");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Theme color policy passed.");
}
