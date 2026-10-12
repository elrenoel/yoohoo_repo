"use client";

import { useEffect, useRef } from "react";
import { trackFeedEvent } from "@/lib/feed-events-client";

export default function FeedItemTracker({itemType,itemId,children}:{itemType:"post"|"deck";itemId:string;children:React.ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=ref.current;
    if(!node)return;
    let enteredAt=0,queuedView:ReturnType<typeof trackFeedEvent>|null=null,timer:ReturnType<typeof setTimeout>|null=null;
    const finishDwell=()=>{
      if(queuedView)queuedView.dwellMs=Math.max(1,Math.round(performance.now()-enteredAt));
    };
    const observer=new IntersectionObserver(([entry])=>{
      if(entry?.isIntersecting&&entry.intersectionRatio>=0.5){
        if(!enteredAt)enteredAt=performance.now();
        if(!timer&&!queuedView)timer=setTimeout(()=>{queuedView=trackFeedEvent({itemType,itemId,eventType:"view",dwellMs:1_000});timer=null},1_000);
      }else{
        if(timer){clearTimeout(timer);timer=null}
        finishDwell();
        if(!queuedView)enteredAt=0;
      }
    },{threshold:[0,0.5]});
    observer.observe(node);
    return()=>{if(timer)clearTimeout(timer);finishDwell();observer.disconnect()};
  },[itemId,itemType]);
  return <div ref={ref}>{children}</div>;
}
