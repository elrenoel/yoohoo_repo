import assert from "node:assert/strict";
import test from "node:test";
import { isProtectedPage, isPublicApiRequest } from "../proxy";

test("new API endpoints are private by default", () => {
  assert.equal(isPublicApiRequest("/api/future-endpoint", "GET"), false);
  assert.equal(isPublicApiRequest("/api/future-endpoint", "POST"), false);
});

test("public routes are allowlisted by method", () => {
  assert.equal(isPublicApiRequest("/api/explore", "GET"), true);
  assert.equal(isPublicApiRequest("/api/explore", "POST"), false);
  assert.equal(isPublicApiRequest("/api/public-decks/example", "GET"), true);
  assert.equal(isPublicApiRequest("/api/public-decks/example/attempts", "POST"), false);
  assert.equal(isPublicApiRequest("/api/comments", "GET"), true);
  assert.equal(isPublicApiRequest("/api/comments", "POST"), false);
});

test("account pages are protected without hiding public profiles", () => {
  assert.equal(isProtectedPage("/home"), true);
  assert.equal(isProtectedPage("/desk/deck-id"), true);
  assert.equal(isProtectedPage("/profile"), true);
  assert.equal(isProtectedPage("/profile/someone"), false);
  assert.equal(isProtectedPage("/u/someone"), false);
  assert.equal(isProtectedPage("/explore"), false);
});
