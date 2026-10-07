import { ragSql } from "@/lib/rag/db"; import { ragResponseError,sessionUser } from "@/lib/rag/http"; import { notify } from "@/lib/public-decks";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const userId=await sessionUser(request),{id}=await params,sql=ragSql();const result=await sql.begin(async tx=>{
 const rows=await tx`select * from public.public_decks where id=${id} and status='published' for update`;const source=rows[0];if(!source)return null;
 const deck=await tx`insert into public.decks(user_id,title) values(${userId},${`${source.title} (Fork)`}) returning id,title`;
 const doc=await tx`insert into public.documents(title,raw_text,user_id,status,content_language) values(${`${source.title} — snapshot publik`},'',${userId},'ready_for_selection',${source.language}) returning id`;
 await tx`insert into public.deck_documents(deck_id,document_id) values(${deck[0].id},${doc[0].id})`;
 await tx`insert into public.flashcards(document_id,deck_id,term,definition) select ${doc[0].id},${deck[0].id},front,back from public.public_deck_cards where public_deck_id=${id} order by position`;
 const questionCount=await tx<{count:number}[]>`select count(*)::int count from public.public_deck_questions where public_deck_id=${id}`;
 if((questionCount[0]?.count??0)>0){const set=await tx`insert into public.quiz_sets(document_id,label) values(${doc[0].id},'Snapshot publik') returning id`;await tx`insert into public.quiz_questions(document_id,question,options,correct_index,quiz_set_id,explanation,difficulty) select ${doc[0].id},question,options,correct_index,${set[0].id},explanation,difficulty from public.public_deck_questions where public_deck_id=${id} order by position`;}
 await tx`update public.public_decks set fork_count=fork_count+1 where id=${id}`;
 await notify(tx,String(source.owner_id),"fork","Deck kamu di-fork",`“${source.title}” ditambahkan ke Your Desk pengguna lain.`,`/d/${source.slug}`,userId,"public_deck",id);
 await notify(tx,userId,"deck_forked","Deck berhasil di-fork",`“${source.title}” telah ditambahkan ke Your Desk.`,`/desk/${deck[0].id}`);
 return{deckId:String(deck[0].id)};
 });if(!result)return Response.json({error:"Deck publik tidak ditemukan."},{status:404});return Response.json(result,{status:201});}catch(error){return ragResponseError(error)}}
