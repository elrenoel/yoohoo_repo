"use client";
import {useQuery} from "@tanstack/react-query";
import {queryKeys} from "@/lib/query-keys";

export type PublicDeckData={deck:{id:string;sourceDeckId:string|null;slug:string;title:string;description:string;tags:string[];language:string;visibility:"public"|"unlisted";isOwner:boolean;version:number;viewCount:number;forkCount:number;likeCount:number;commentCount:number;repostCount:number;likedByMe:boolean;bookmarkedByMe:boolean;repostedByMe:boolean;owner:{username:string;displayName:string};cardCount:number;questionCount:number};cards:Array<{id:string;front:string;back:string;blobVariant:number|null}>;questions:Array<{id:string;question:string;options:string[];difficulty:string}>;stats:{completions:number;attempts:number;averageScore:number|null}};
export function usePublicDeck(slug:string){return useQuery<PublicDeckData>({queryKey:queryKeys.publicDeck(slug),queryFn:async({signal})=>{const response=await fetch(`/api/public-decks/${encodeURIComponent(slug)}`,{signal});const body=await response.json();if(!response.ok)throw new Error(body.error||"Deck tidak ditemukan.");return body}})}
