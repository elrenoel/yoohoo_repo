import { ragSql } from "@/lib/rag/db";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const userId=await sessionUser(request),id=documentId((await params).id),sql=ragSql();
    const[group]=await sql`select g.id,g.deck_id,g.name from public.flashcard_groups g where g.id=${id} and g.user_id=${userId}`;
    if(!group)return Response.json({error:"Grup flashcard tidak ditemukan."},{status:404});
    const cards=await sql`select f.id,f.term,f.definition,f.source_document_id,d.title source_title from public.flashcards f join public.documents d on d.id=f.source_document_id where f.group_id=${id} order by f.id`;
    return Response.json({group:{id:String(group.id),deckId:String(group.deck_id),name:String(group.name)},flashcards:cards.map(c=>({id:String(c.id),term:String(c.term),definition:String(c.definition),sourceDocumentId:String(c.source_document_id),sourceTitle:String(c.source_title)}))});
  }catch(error){return ragResponseError(error)}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const userId=await sessionUser(request),id=documentId((await params).id),body=await jsonBody(request),name=typeof body.name==="string"?body.name.trim():"";
    if(!name)return Response.json({error:"Nama grup wajib diisi."},{status:400});if(name.length>60)return Response.json({error:"Nama grup maksimal 60 karakter."},{status:400});
    const[row]=await ragSql()`update public.flashcard_groups set name=${name},updated_at=now() where id=${id} and user_id=${userId} returning id,name`;
    if(!row)return Response.json({error:"Grup flashcard tidak ditemukan."},{status:404});return Response.json({group:{id:String(row.id),name:String(row.name)}});
  }catch(error){return ragResponseError(error)}
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const userId=await sessionUser(request),id=documentId((await params).id);const[row]=await ragSql()`delete from public.flashcard_groups where id=${id} and user_id=${userId} returning id`;
    if(!row)return Response.json({error:"Grup flashcard tidak ditemukan."},{status:404});return Response.json({success:true});
  }catch(error){return ragResponseError(error)}
}
