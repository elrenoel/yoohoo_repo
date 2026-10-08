"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type PostImage = { id: string; url: string; width: number; height: number; altText: string | null };

export default function PostImageGallery({ images }: { images: PostImage[] }) {
  const [open, setOpen] = useState<PostImage | null>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [open]);
  if (!images.length) return null;

  const single = images.length === 1;
  return <>
    <div className={`mt-4 ${single ? "" : "grid grid-cols-2 gap-1.5 overflow-hidden rounded-2xl"}`}>
      {images.map(image => {
        const portrait = image.height > image.width;
        return <button key={image.id} type="button" onClick={() => setOpen(image)} className={`relative block overflow-hidden border border-[#D8DCD3] bg-[#E9EDE8] text-left ${single ? `rounded-2xl ${portrait ? "w-full max-w-[430px]" : "w-full"}` : "aspect-square"}`}>
          <Image src={image.url} alt={image.altText || "Post image"} width={image.width} height={image.height} unoptimized className={single ? `block w-full ${portrait ? "max-h-[600px] object-contain" : "max-h-[520px] object-cover"}` : "h-full w-full object-cover"} />
        </button>;
      })}
    </div>

    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setOpen(null)}>
      <button type="button" className="absolute left-5 top-5 rounded-full border border-white/25 bg-white/10 p-2 text-white" aria-label="Close image preview"><X /></button>
      <Image src={open.url} alt={open.altText || "Post image"} width={open.width} height={open.height} unoptimized onClick={event => event.stopPropagation()} className="max-h-[90vh] max-w-[94vw] object-contain" />
    </div>}
  </>;
}
