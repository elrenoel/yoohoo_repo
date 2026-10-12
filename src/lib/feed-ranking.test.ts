import assert from "node:assert/strict";
import test from "node:test";
import { rerankFeedCandidates, type RankedFeedCandidate } from "./feed-ranking";

function candidate(id:number,author:string,exploration=false):RankedFeedCandidate{return{item_type:"post",item_id:`00000000-0000-4000-8000-${String(id).padStart(12,"0")}`,author_id:author,published_at:new Date(2026,0,id).toISOString(),final_score:100-id,exploration_eligible:exploration,exploration_ratio:0.15}}

test("reranking never emits three consecutive items from one author",()=>{
  const input=[candidate(1,"a"),candidate(2,"a"),candidate(3,"a"),candidate(4,"b"),candidate(5,"a")];
  const result=rerankFeedCandidates(input,5);
  for(let index=2;index<result.length;index+=1){
    assert.equal(result[index].author_id===result[index-1].author_id&&result[index].author_id===result[index-2].author_id,false);
  }
});

test("reranking places an eligible exploration item near the configured interval",()=>{
  const input=Array.from({length:10},(_,index)=>candidate(index+1,`author-${index}`,index===8));
  const result=rerankFeedCandidates(input,10);
  assert.equal(result[6]?.exploration_eligible,true);
});
