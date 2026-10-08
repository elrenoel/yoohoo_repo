import assert from "node:assert/strict";
import test from "node:test";
import { OptimisticIntentCoordinator, type OptimisticIntentResponse } from "./use-optimistic-intent-mutation";

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

function coordinator(
  entityKey: string,
  request: (desired: boolean) => Promise<OptimisticIntentResponse>,
  updates: OptimisticIntentResponse[],
) {
  return new OptimisticIntentCoordinator({
    entityKey,
    initialState: { active: false, count: 0 },
    debounceMs: 5,
    request,
    updateCache: state => updates.push(state),
    onError: () => undefined,
  });
}

test("spam 7 clicks coalesces into one request with the final state", async () => {
  const requests: boolean[] = [];
  const updates: OptimisticIntentResponse[] = [];
  const intent = coordinator("like:post:one", async desired => {
    requests.push(desired);
    return { active: desired, count: desired ? 1 : 0 };
  }, updates);

  for (let index = 0; index < 7; index += 1) intent.setDesiredState(index % 2 === 0);
  await wait(30);

  assert.deepEqual(requests, [true]);
  assert.equal(intent.getSnapshot().active, true);
  assert.equal(intent.getSnapshot().count, 1);
  intent.dispose();
});

test("different entity actions do not block one another", async () => {
  let releaseLike: ((value: OptimisticIntentResponse) => void) | undefined;
  let releaseRepost: ((value: OptimisticIntentResponse) => void) | undefined;
  const likeCalls: boolean[] = [];
  const repostCalls: boolean[] = [];
  const like = coordinator("like:post:two", desired => new Promise(resolve => { likeCalls.push(desired); releaseLike = resolve; }), []);
  const repost = coordinator("repost:post:two", desired => new Promise(resolve => { repostCalls.push(desired); releaseRepost = resolve; }), []);

  like.setDesiredState(true);
  repost.setDesiredState(true);
  await wait(15);

  assert.deepEqual(likeCalls, [true]);
  assert.deepEqual(repostCalls, [true]);
  releaseLike?.({ active: true, count: 1 });
  releaseRepost?.({ active: true, count: 1 });
  await wait(0);
  like.dispose();
  repost.dispose();
});

test("a failed item rolls back without changing another item", async () => {
  const first = coordinator("bookmark:post:first", async () => { throw new Error("offline"); }, []);
  const second = coordinator("bookmark:post:second", async desired => ({ active: desired }), []);

  first.setDesiredState(true);
  second.setDesiredState(true);
  await wait(30);

  assert.equal(first.getSnapshot().active, false);
  assert.equal(second.getSnapshot().active, true);
  first.dispose();
  second.dispose();
});
