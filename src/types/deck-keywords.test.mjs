import assert from "node:assert/strict";
import test from "node:test";
import { deckKeywordsResponseSchema, generateFlashcardsRequestSchema } from "./deck-keywords.ts";

const documentId="babf4930-cda5-4370-8a68-7fe18b1ef769";
const keywordId="95acf49f-fb5c-4781-8b31-2fada4d1fc39";

test("keyword response requires the shared documentId property",()=>{
 const valid=deckKeywordsResponseSchema.safeParse({documents:[{documentId,title:"Material",keywords:[]}]});
 const legacy=deckKeywordsResponseSchema.safeParse({documents:[{id:documentId,title:"Material",keywords:[]}]});
 assert.equal(valid.success,true);
 assert.equal(legacy.success,false);
});

test("generate request rejects empty selections and missing document_id",()=>{
 const base={idempotencyKey:crypto.randomUUID()};
 assert.equal(generateFlashcardsRequestSchema.safeParse({...base,selections:[]}).success,false);
 assert.equal(generateFlashcardsRequestSchema.safeParse({...base,selections:[{keyword_ids:[keywordId]}]}).success,false);
});

test("generate request accepts a valid material and keyword pair",()=>{
 const parsed=generateFlashcardsRequestSchema.safeParse({
  idempotencyKey:crypto.randomUUID(),groupName:"Ujian",
  selections:[{document_id:documentId,keyword_ids:[keywordId]}],
 });
 assert.equal(parsed.success,true);
});
