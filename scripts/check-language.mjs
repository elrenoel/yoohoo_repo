import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const allowedFiles = new Set([
  "locales/id.json",
  "lib/ai.ts",
  "lib/rag/ai.ts",
  "lib/rag/core-keywords.ts",
  "lib/mock-data.ts",
]);
const words = /\b(?:berhasil|gagal|belum|sudah|notifikasi|sampah|materi|profil|kartu|grup|hapus|batal|kembali|pengikut|mengikuti|jawaban|pertanyaan|kamu|anda|seseorang|pengguna|publik|terbit|soal|coba|pilih|simpan|ubah|tulis|pratinjau|kosong|dipindahkan|diterima|dibuat|diperbarui|dihapus|dipulihkan|dibagikan)\b/i;
const stringLiteral = /(["'`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g;

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const failures = [];
for (const file of files(root)) {
  if (![".ts", ".tsx"].includes(extname(file))) continue;
  const name = relative(root, file).replaceAll("\\", "/");
  if (allowedFiles.has(name) || name.endsWith(".test.ts")) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(stringLiteral)) {
    if (!words.test(match[2])) continue;
    const line = source.slice(0, match.index).split("\n").length;
    failures.push(`${name}:${line}: ${match[2].slice(0, 120)}`);
  }
}

if (failures.length) {
  console.error("Indonesian UI/API copy found:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Language policy passed.");
}
