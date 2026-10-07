import { z } from "zod";

const cursorSchema=z.object({publishedAt:z.iso.datetime(),id:z.uuid()});
export type FeedCursor=z.infer<typeof cursorSchema>;
export function encodeCursor(value:FeedCursor){return Buffer.from(JSON.stringify(value)).toString("base64url")}
export function decodeCursor(value:string|null):FeedCursor|null{if(!value)return null;try{return cursorSchema.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")))}catch{return null}}
const userCursorSchema=z.object({publishedAt:z.iso.datetime(),id:z.string().min(1).max(255)});
export function encodeUserCursor(value:z.infer<typeof userCursorSchema>){return Buffer.from(JSON.stringify(value)).toString("base64url")}
export function decodeUserCursor(value:string|null){if(!value)return null;try{return userCursorSchema.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")))}catch{return null}}
