import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import dns from "node:dns";
import { generateStudyMaterials } from "../src/lib/ai";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

dotenv.config({ path: ".env.local" });

async function main() {
  console.log("\n============================================================");
  console.log("⚡ Yoohoo AI Pipeline Test (Multi-Tier Fallback Optimization)");
  console.log("============================================================\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "AIzaSy...") {
    console.error("❌ ERROR: GEMINI_API_KEY belum diisi di file .env.local.");
    process.exit(1);
  }

  // Determine file to process
  const customFileArg = process.argv[2];
  const defaultFile = path.join(process.cwd(), "sample-materials", "operating-systems.txt");
  const targetFilePath = customFileArg ? path.resolve(process.cwd(), customFileArg) : defaultFile;

  if (!fs.existsSync(targetFilePath)) {
    console.error(`❌ File materi tidak ditemukan: ${targetFilePath}`);
    process.exit(1);
  }

  const materialContent = fs.readFileSync(targetFilePath, "utf-8");
  const wordCount = materialContent.trim().split(/\s+/).length;

  console.log(`📄 Menguji file materi : ${path.relative(process.cwd(), targetFilePath)}`);
  console.log(`📊 Ukuran materi       : ${materialContent.length} karakter (~${wordCount} kata)`);
  console.log(`🤖 Menghubungi Google Gemini API... Mohon tunggu sebentar...\n`);

  try {
    const result = await generateStudyMaterials(materialContent);

    console.log("============================================================");
    console.log(`✅ HASIL EKSTRAKSI AI BERHASIL (${result.latencyMs}ms | Model: ${result.usedModel})`);
    console.log("============================================================\n");

    // 1. Tampilkan Flashcards
    console.log(`📚 FLASHCARDS (${result.flashcards.length} kartu ditemukan):`);
    console.log("------------------------------------------------------------");
    result.flashcards.forEach((card, index) => {
      console.log(`\n  [#${index + 1}] 🏷️  ${card.term.toUpperCase()}`);
      console.log(`      💡 ${card.definition}`);
    });

    // 2. Tampilkan Quiz Questions
    console.log(`\n\n🎯 QUIZ PILIHAN GANDA (${result.quiz.length} soal dibuat):`);
    console.log("------------------------------------------------------------");
    const optionLabels = ["A", "B", "C", "D"];
    result.quiz.forEach((q, index) => {
      console.log(`\n  [Soal ${index + 1}] ❓ ${q.question}`);
      q.options.forEach((opt, optIdx) => {
        const isCorrect = optIdx === q.correct_index;
        const prefix = isCorrect ? "   ✓" : "    ";
        const badge = isCorrect ? `[${optionLabels[optIdx]}]* (BENAR)` : `[${optionLabels[optIdx]}] `;
        console.log(`${prefix} ${badge} ${opt}`);
      });
    });

    console.log("\n============================================================");
    console.log("📊 RINGKASAN VALIDASI:");
    console.log(`  • Model digunakan   : ${result.usedModel}`);
    console.log(`  • Flashcard count   : ${result.flashcards.length} kartu`);
    console.log(`  • Quiz count        : ${result.quiz.length} soal (4 opsi per soal)`);
    console.log(`  • Latency           : ${((result.latencyMs || 0) / 1000).toFixed(2)} detik`);
    console.log("============================================================\n");

  } catch (error) {
    console.error("\n❌ GAGAL MEMPROSES DENGAN GEMINI API:");
    if (error instanceof Error) {
      console.error(`Pesan Error: ${error.message}`);
    } else {
      console.error(error);
    }
    console.log("\n============================================================\n");
    process.exit(1);
  }
}

main();
