import test from "node:test";
import assert from "node:assert/strict";
import { escapeLikePattern, parseExploreSearchQuery } from "./explore";

test("parses mixed, account, and tag searches", () => {
  assert.deepEqual(parseExploreSearchQuery("  elreno   noelson "), { mode:"mixed", raw:"elreno noelson", term:"elreno noelson", tags:[] });
  assert.equal(parseExploreSearchQuery("@Elrenoel").mode, "account");
  assert.deepEqual(parseExploreSearchQuery("#Python #Dasar").tags, ["python", "dasar"]);
  assert.deepEqual(parseExploreSearchQuery("# python").tags, ["python"]);
  assert.equal(parseExploreSearchQuery("a").mode, "idle");
});

test("escapes LIKE metacharacters", () => {
  assert.equal(escapeLikePattern("50%_off\\x"), "50\\%\\_off\\\\x");
});
