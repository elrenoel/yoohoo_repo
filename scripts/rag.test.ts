import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chunkPages, isSnippetEcho, parseKeywords } from "../src/lib/rag/core";
import { extractChunks, renderScanPages } from "../src/lib/rag/pdf";
import { pdfKey } from "../src/lib/rag/storage";
import { parseGeneratedFlashcards, parseRepresentativeQuiz, representativeQuizCount } from "../src/lib/rag/materials";
import { samplePdf } from "./rag-fixture";

test("all text after 8000 words survives chunking, including last partial chunk", () => {
  const pages = Array.from({ length: 13 }, (_, i) => `page${i} ` + "content ".repeat(1000));
  const chunks = chunkPages(pages);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[2].pageEnd, 13);
  for (const page of pages) assert.ok(chunks.some(chunk => chunk.content.includes(page)));
});
test("chunk boundaries retain the last two paragraphs as context", () => {
  const pages = ["satu\n\n dua\n\n tiga", "empat", "lima", "enam", "tujuh", "delapan"];
  const chunks = chunkPages(pages, 5, 2);
  assert.match(chunks[1].content, /^enam\n\ntujuh\n\ndelapan$/);
});
test("scan detection includes sparse single-page and mixed PDFs", () => {
  const chunk = chunkPages(["", "word ".repeat(30), "handwriting", "word ".repeat(25), ""])[0];
  assert.deepEqual(chunk.scanPages, [1, 3, 5]);
});
test("keyword parsing rejects unusable output and dedupes exact normalized terms", () => {
  const data = parseKeywords(JSON.stringify([{ term: " Paging ", snippet: "Memory divided into pages" }, { term: "paging", snippet: "Another sentence" }, { term: "", snippet: "invalid" }]));
  assert.equal(data.length, 1);
  assert.throws(() => parseKeywords("not json"));
  assert.throws(() => parseKeywords('{"term":"Paging"}'));
  assert.deepEqual(parseKeywords('[{"term":"Paging","snippet":""}]'), []);
  assert.deepEqual(parseKeywords('[{"term":"Heading","snippet":"Heading"}]'), []);
});
test("snippet echo filter rejects labels but keeps an actual explanation", () => {
  assert.equal(isSnippetEcho("Binary Insertion Sort", "Binary Insertion Sort"), true);
  assert.equal(isSnippetEcho("Bubble Sort", "Algoritma transposisi Bubble Sort"), true);
  assert.equal(isSnippetEcho("Bubble Sort", "Bubble Sort membandingkan elemen berdekatan dan menukarnya bila urutannya salah."), false);
});
test("object paths cannot be redirected to a different Better Auth user", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.notEqual(pdfKey("userA", id), pdfKey("userB", id));
  assert.match(pdfKey("../../evil", id), /^uploads\/[a-f0-9]{64}\/[a-f0-9-]+\.pdf$/);
});
test("real PDF extraction and native image rendering", async () => {
  const bytes = samplePdf();
  const parsed = await extractChunks(bytes);
  assert.equal(parsed.pageCount, 1);
  assert.match(parsed.chunks[0].content, /Virtual memory/);
  assert.deepEqual(parsed.chunks[0].scanPages, []);
  const [png] = await renderScanPages(bytes, [1]);
  assert.deepEqual([...png.slice(0, 8)], [137,80,78,71,13,10,26,10]);
});
test("workflow bounds concurrency, discards worker payloads, and handles failed chunks", () => {
  const asl = JSON.parse(readFileSync("infra/rag/state-machine.asl.json", "utf8"));
  const map = asl.States.ProcessChunks;
  assert.equal(map.MaxConcurrency, 1);
  assert.equal(map.ResultPath, null);
  assert.equal(map.ItemProcessor.States.ExtractKeywords.Catch[0].Next, "RecordSkippedChunk");
  assert.ok(asl.States.MarkFailed);
  assert.equal(asl.States.RouteMode.Choices[0].Next, "GenerateSelected");
  assert.equal(asl.States.GenerateSelected.MaxConcurrency, 1);
  assert.equal(asl.States.GenerateSelected.ResultPath, null);
  assert.equal(asl.States.GenerateSelected.ItemsPath, "$.batchIds");
  assert.equal(asl.States.GenerateSelected.ItemProcessor.States.GenerateChunkMaterials.Next, "WaitBeforeNextBatch");
  assert.equal(asl.States.GenerateSelected.ItemProcessor.States.GenerateChunkMaterials.Catch[0].Next, "RecordGenerationFailure");
});
test("selected flashcard parsing keeps valid batch items and skips malformed ones", () => {
  const selected = [{ id: "keyword-1", term: "Paging", snippet: "Memory pages", chunk_id: "chunk-1" }, { id: "keyword-2", term: "TLB", snippet: "Translation cache", chunk_id: "chunk-2" }];
  const result = parseGeneratedFlashcards(JSON.stringify([{
    keyword_id: "keyword-1", term: "Paging", definition: "A memory management technique.",
  }]), selected);
  assert.equal(result.flashcards.length, 1);
  assert.throws(() => parseGeneratedFlashcards("[]", selected));
  const partiallyValid = parseGeneratedFlashcards(JSON.stringify([{
    keyword_id: "keyword-1", term: "Paging", definition: "",
  }, {
    keyword_id: "keyword-2", term: "TLB", definition: "A translation cache.",
  }]), selected);
  assert.equal(partiallyValid.flashcards.length, 1);
});
test("representative quiz count is bounded and quiz validation requires every requested item", () => {
  assert.equal(representativeQuizCount(1), 5);
  assert.equal(representativeQuizCount(15), 5);
  assert.equal(representativeQuizCount(31), 10);
  assert.equal(representativeQuizCount(100), 20);
  const question = { question: "What is the purpose of paging?", options: ["A", "B", "C", "D"], correct_index: 0, explanation: "Paging divides memory into fixed-size pages." };
  assert.equal(parseRepresentativeQuiz(JSON.stringify(Array.from({ length: 5 }, (_, index) => ({ ...question, question: `${question.question} ${index}` }))), 5).length, 5);
  assert.throws(() => parseRepresentativeQuiz(JSON.stringify([question]), 5));
});
test("IAM has no administrator actions or all-resource Allow grants", () => {
  const template = JSON.parse(readFileSync("infra/rag/template.json", "utf8"));
  for (const resource of Object.values(template.Resources) as { Type: string; Properties: { Policies?: { PolicyDocument: { Statement: { Effect: string; Action: string | string[]; Resource: unknown }[] } }[] } }[]) {
    if (resource.Type !== "AWS::IAM::Role") continue;
    for (const policy of resource.Properties.Policies ?? []) for (const s of policy.PolicyDocument.Statement) {
      assert.notEqual(s.Resource, "*");
      assert.ok(!JSON.stringify(s.Action).includes("*"));
    }
  }
});
