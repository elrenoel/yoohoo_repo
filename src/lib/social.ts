import "server-only";
import { z } from "zod";
export const targetSchema=z.object({targetType:z.enum(["post","public_deck"]),targetId:z.uuid()});
export const commentSchema=targetSchema.extend({body:z.string().trim().min(1).max(1000),parentId:z.uuid().nullable().optional()});
export const reportSchema=z.object({targetType:z.enum(["post","public_deck","comment","user"]),targetId:z.string().min(1).max(255),reason:z.string().trim().min(3).max(500)});
export function targetTable(type:"post"|"public_deck"){return type==="post"?"posts":"public_decks"}
