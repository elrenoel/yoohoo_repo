"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";

export default function MarkdownContent({children}:{children:string}){
 return <article className="prose max-w-none break-words leading-8 text-text [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-danger [&_blockquote]:pl-4 [&_code]:bg-surface-subtle [&_code]:text-text [&_code]:rounded [&_code]:px-1 [&_h1]:font-serif [&_h1]:text-text [&_h2]:font-serif [&_h2]:text-text [&_h3]:font-serif [&_h3]:text-text [&_li]:text-text [&_p]:text-text [&_strong]:text-text">
  <ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeSanitize,rehypeKatex]} skipHtml>{children}</ReactMarkdown>
 </article>
}
