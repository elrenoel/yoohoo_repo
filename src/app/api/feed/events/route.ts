import { z, ZodError } from "zod";
import { ragSql } from "@/lib/rag/db";
import { jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";

const eventSchema=z.object({
  itemType:z.enum(["post","deck"]),
  itemId:z.uuid(),
  eventType:z.enum(["view","like","comment","share","save","hide"]),
  dwellMs:z.number().int().min(0).transform(value=>Math.min(value,300_000)).optional(),
  createdAt:z.iso.datetime().optional(),
});
const batchSchema=z.object({events:z.array(eventSchema).min(1).max(50)}).strict();

export async function POST(request:Request){
  try{
    const userId=await sessionUser(request),input=batchSchema.parse(await jsonBody(request)),sql=ragSql();
    const events=input.events.map(event=>({item_type:event.itemType,item_id:event.itemId,event_type:event.eventType,dwell_ms:event.dwellMs??null,created_at:event.createdAt??null}));
    const [result]=await sql`select private.record_user_events(${userId},${sql.json(events)}::jsonb) recorded`;
    return Response.json({recorded:Number(result?.recorded??0)});
  }catch(error){
    if(error instanceof ZodError)return Response.json({error:"Batch event tidak valid."},{status:400});
    return ragResponseError(error);
  }
}
