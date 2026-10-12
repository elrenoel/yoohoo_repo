"use client";

export type FeedEventInput={itemType:"post"|"deck";itemId:string;eventType:"view"|"like"|"comment"|"share"|"save"|"hide";dwellMs?:number;createdAt?:string};

const queue:FeedEventInput[]=[];
let timer:ReturnType<typeof setTimeout>|null=null;
let flushing=false;

export function trackFeedEvent(event:FeedEventInput){
  const queuedEvent={...event,createdAt:event.createdAt??new Date().toISOString()};
  queue.push(queuedEvent);
  if(queue.length>=20)void flushFeedEvents();
  else if(!timer)timer=setTimeout(()=>void flushFeedEvents(),5_000);
  return queuedEvent;
}

export async function flushFeedEvents(){
  if(flushing||!queue.length)return;
  flushing=true;
  if(timer){clearTimeout(timer);timer=null}
  const events=queue.splice(0,50);
  try{
    const response=await fetch("/api/feed/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({events}),keepalive:true});
    if(!response.ok&&response.status!==401)queue.unshift(...events);
  }catch{queue.unshift(...events)}finally{
    flushing=false;
    if(queue.length&&!timer)timer=setTimeout(()=>void flushFeedEvents(),5_000);
  }
}

if(typeof window!=="undefined")window.addEventListener("pagehide",()=>{
  if(!queue.length)return;
  const events=queue.splice(0,50);
  const body=JSON.stringify({events});
  const sent=navigator.sendBeacon?.("/api/feed/events",new Blob([body],{type:"application/json"}))??false;
  if(!sent)void fetch("/api/feed/events",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true});
});
