import assert from "node:assert/strict";
import test from "node:test";
import { interactionNotificationKey, shouldCreateInteractionNotification } from "./interaction-notifications";

test("duplicate repost and save intents resolve to one stable notification key", () => {
  const repostKeys = [
    interactionNotificationKey("actor-1", "repost", "post", "post-1"),
    interactionNotificationKey("actor-1", "repost", "post", "post-1"),
  ];
  const saveKeys = [
    interactionNotificationKey("actor-1", "save", "post", "post-1"),
    interactionNotificationKey("actor-1", "save", "post", "post-1"),
  ];
  assert.equal(new Set(repostKeys).size, 1);
  assert.equal(new Set(saveKeys).size, 1);
});

test("undo addresses the same key that insert created", () => {
  const created = interactionNotificationKey("actor-2", "save", "post", "post-2");
  const removed = interactionNotificationKey("actor-2", "save", "post", "post-2");
  assert.equal(removed, created);
});

test("an interaction on the actor's own post does not create a notification", () => {
  assert.equal(shouldCreateInteractionNotification("user-1", "user-1"), false);
  assert.equal(shouldCreateInteractionNotification("owner-1", "actor-1"), true);
});
