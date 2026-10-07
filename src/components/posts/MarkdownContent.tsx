"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";

export default function MarkdownContent({children}:{children:string}){
 return <article className="prose prose-neutral max-w-none break-words leading-8 text-[#26372E] [&_a]:text-[#164C3D] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#C24A3D] [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-[#E9ECE7] [&_code]:px-1 [&_h1]:font-serif [&_h2]:font-serif [&_h3]:font-serif">
  <ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeSanitize,rehypeKatex]} skipHtml>{children}</ReactMarkdown>
 </article>
}
