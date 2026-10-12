import {NextRequest,NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {ragSql} from "@/lib/rag/db";
import {UUID} from "@/lib/rag/core";
import {handleApiError} from "@/lib/api-error";

export async function GET(request:NextRequest,props:{params:Promise<{id:string}>}){
  try{
    const{id}=await props.params;
    if(!UUID.test(id))return NextResponse.json({success:false,error:"ID dokumen tidak valid."},{status:400});
    const session=await auth.api.getSession({headers:request.headers});
    if(!session?.user)return NextResponse.json({success:false,error:"Silakan login terlebih dahulu.",requireAuth:true},{status:401});
    const sql=ragSql(),[doc]=await sql`select id,title from public.documents where id=${id} and user_id=${session.user.id} and deleted_at is null`;
    if(!doc)return NextResponse.json({success:false,error:"Dokumen tidak ditemukan."},{status:404});
    const attempts=await sql`select a.id,a.score,a.total,a.answers,a.created_at,a.quiz_set_id,qs.label
      from public.quiz_attempts a join public.quiz_sets qs on qs.id=a.quiz_set_id
      left join public.flashcard_groups g on g.id=qs.group_id
      where a.document_id=${id} and a.user_id=${session.user.id}
        and (qs.document_id=${id} or g.user_id=${session.user.id})
      order by a.created_at desc`;
    return NextResponse.json({success:true,document:doc,attempts:attempts.map(a=>({id:a.id,score:a.score,total:a.total,answers:a.answers,createdAt:a.created_at,quizSetId:a.quiz_set_id,quizSetLabel:a.label??null}))});
  }catch(error){return handleApiError(error,"GET /api/documents/:id/attempts")}
}
