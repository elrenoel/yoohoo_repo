import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-error";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success:false,error:"Silakan masuk (login) terlebih dahulu untuk melihat histori dokumen.",requireAuth:true },{status:401});
    const docs = await db.from("documents").select("id,title,created_at,storage_path,is_starred,starred_at").eq("user_id",session.user.id).is("deleted_at",null).order("is_starred",{ascending:false}).order("starred_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false});
    if (docs.error) throw docs.error;
    const ids=docs.data.map(d=>d.id); const last:Record<string,{score:number;total:number;createdAt:string}>={}; const withFlashcards=new Set<string>();
    if(ids.length){const attempts=await db.from("quiz_attempts").select("document_id,score,total,created_at").in("document_id",ids).order("created_at",{ascending:false});if(attempts.error)throw attempts.error;for(const a of attempts.data)if(!last[a.document_id])last[a.document_id]={score:a.score,total:a.total,createdAt:a.created_at};}
    if(ids.length){const cards=await db.from("flashcards").select("document_id").in("document_id",ids);if(cards.error)throw cards.error;for(const card of cards.data)withFlashcards.add(card.document_id);}
    return NextResponse.json({success:true,documents:docs.data.map(d=>({id:d.id,title:d.title,createdAt:d.created_at,isStarred:d.is_starred,starredAt:d.starred_at,isRagDocument:!!d.storage_path,hasFlashcards:withFlashcards.has(d.id),lastAttempt:last[d.id]??null}))});
  } catch(error){return handleApiError(error,"GET /api/documents");}
}
