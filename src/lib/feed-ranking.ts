export type RankedFeedCandidate = {
  item_type: "post" | "deck";
  item_id: string;
  author_id: string;
  published_at: string | Date;
  final_score: number;
  exploration_eligible: boolean;
  exploration_ratio: number;
};

export function rerankFeedCandidates(candidates: RankedFeedCandidate[], limit: number) {
  const remaining = [...candidates];
  const selected: RankedFeedCandidate[] = [];
  const explorationRatio = candidates[0]?.exploration_ratio ?? 0.15;
  const explorationSlots = new Set<number>();
  if (explorationRatio > 0) {
    const interval = Math.max(2, Math.round(1 / explorationRatio));
    for (let slot = interval - 1; slot < limit; slot += interval) explorationSlots.add(slot);
  }

  while (selected.length < limit && remaining.length) {
    const last = selected.at(-1)?.author_id;
    const beforeLast = selected.at(-2)?.author_id;
    const wouldMakeThree = (candidate: RankedFeedCandidate) => candidate.author_id === last && candidate.author_id === beforeLast;
    const wantsExploration = explorationSlots.has(selected.length);
    let index = remaining.findIndex(candidate => (!wantsExploration || candidate.exploration_eligible) && !wouldMakeThree(candidate));
    if (index < 0) index = remaining.findIndex(candidate => !wouldMakeThree(candidate));
    if (index < 0) break;
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
}
