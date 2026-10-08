"use client";

import Image from "next/image";
import { ImagePlus, Layers3, LoaderCircle, Send, Tag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { POST_MAX_IMAGES, POST_MAX_LENGTH } from "@/lib/post";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";
import { DECK_CARD_COLORS, DECK_CARD_THEMES, type DeckCardColor } from "@/lib/deck-card-colors";
import UserAvatar from "@/components/profile/UserAvatar";

type Uploaded = { id: string; url: string; width: number; height: number; altText: string | null };
type Deck = { id: string; slug: string; title: string; description: string; tags: string[] };

async function resize(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("The image could not be processed.")), "image/webp", 0.85));
  return new File([blob], "post.webp", { type: "image/webp" });
}

export default function PostComposer({ onPosted }: { onPosted: () => void }) {
  const toast = useToast();
  const { data: session } = useSession();
  const area = useRef<HTMLTextAreaElement>(null);
  const staged = useRef<Uploaded[]>([]);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<Uploaded[]>([]);
  const [deckId, setDeckId] = useState("");
  const [deckColor, setDeckColor] = useState<DeckCardColor>("green");
  const [deckPickerOpen, setDeckPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const posts = useQuery<{ decks: Deck[] }>({
    queryKey: queryKeys.posts(session?.user?.id),
    queryFn: async ({ signal }) => { const response = await fetch("/api/posts", { signal }); if (!response.ok) throw new Error("Posts could not be loaded."); return response.json(); },
    enabled: Boolean(session?.user),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const decks = posts.data?.decks ?? [];
  const selectedDeck = decks.find(deck => deck.id === deckId);
  const displayName = session?.user?.name || session?.user?.email?.split("@")[0] || "You";
  const valid = Boolean(body.trim() || images.length || deckId);

  useEffect(() => () => { for (const image of staged.current) void fetch(`/api/post-images/${image.id}`, { method: "DELETE", keepalive: true }); }, []);
  useEffect(() => { staged.current = images; }, [images]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("yoohoo:open-composer", show);
    if (new URLSearchParams(window.location.search).get("compose") === "1") {
      window.setTimeout(show, 0);
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    return () => window.removeEventListener("yoohoo:open-composer", show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !sending && !uploading) setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => area.current?.focus(), 50);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [open, sending, uploading]);

  async function pick(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, POST_MAX_IMAGES - images.length)) {
        const processed = await resize(file);
        const form = new FormData();
        form.set("file", processed);
        const response = await fetch("/api/post-images", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setImages(current => [...current, data.image]);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed."); }
    finally { setUploading(false); }
  }

  async function remove(image: Uploaded) {
    setImages(current => current.filter(item => item.id !== image.id));
    await fetch(`/api/post-images/${image.id}`, { method: "DELETE" });
  }

  async function cancel() {
    if (sending || uploading) return;
    await Promise.all(images.map(image => fetch(`/api/post-images/${image.id}`, { method: "DELETE" })));
    staged.current = [];
    setImages([]);
    setBody("");
    setTags("");
    setDeckId("");
    setDeckColor("green");
    setDeckPickerOpen(false);
    setOpen(false);
  }

  async function send() {
    setSending(true);
    const toastId = toast.loading("Publishing post...");
    try {
      const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, tags: tags.split(",").map(value => value.trim()).filter(Boolean), imageIds: images.map(image => image.id), deckId: deckId || null, deckColor }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      staged.current = [];
      setBody(""); setTags(""); setImages([]); setDeckId(""); setDeckColor("green"); setDeckPickerOpen(false); setOpen(false);
      toast.success("Post published.", { id: toastId });
      onPosted();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The post could not be published.", { id: toastId }); }
    finally { setSending(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-[#D8DCD3] bg-white px-4 py-4 text-left transition hover:border-[#AEB8AF]">
      <UserAvatar src={session?.user?.image} name={displayName} size={40} textClassName="text-sm"/>
      <span className="text-sm text-[#7A8780]">What&apos;s on your mind?</span>
    </button>

    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#09100C]/60 px-4 py-8 backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) void cancel(); }}>
      <section role="dialog" aria-modal="true" aria-label="Create post" className="flex min-h-[430px] w-full max-w-[620px] flex-col rounded-[22px] border border-[#3D4640] bg-[#F9FAF7] p-5 shadow-[0_26px_80px_rgba(0,0,0,.32)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><UserAvatar src={session?.user?.image} name={displayName} size={40} textClassName="text-sm"/><div><p className="text-sm font-semibold">{displayName}</p><p className="text-xs text-[#7A8780]">Create a post</p></div></div>
          <button type="button" onClick={() => void cancel()} disabled={sending || uploading} aria-label="Close" className="rounded-full p-2 text-[#5B6B62] hover:bg-[#EEF1EB]"><X className="h-4 w-4" /></button>
        </div>

        <textarea ref={area} value={body} onChange={event => setBody(event.target.value.slice(0, POST_MAX_LENGTH))} placeholder="What&apos;s on your mind?" className="mt-4 min-h-36 flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-[#89938D]" />
        <div className="text-right text-[10px] text-[#7A8780]">{body.length}/{POST_MAX_LENGTH}</div>

        {images.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{images.map(image => <div key={image.id} className="relative overflow-hidden rounded-xl border border-[#D8DCD3]"><Image src={image.url} alt={image.altText || "Post preview"} width={image.width} height={image.height} unoptimized className="h-32 w-full object-cover" /><button type="button" onClick={() => void remove(image)} className="absolute right-2 top-2 rounded-full bg-white p-1"><X className="h-3.5 w-3.5" /></button><input value={image.altText || ""} onChange={event => setImages(current => current.map(item => item.id === image.id ? { ...item, altText: event.target.value.slice(0, 200) } : item))} placeholder="Alt text" className="w-full border-t border-[#D8DCD3] px-2 py-1.5 text-xs outline-none" /></div>)}</div>}

        <div className="mt-4 flex items-center rounded-lg border border-[#D8DCD3] bg-white px-3"><Tag className="mr-2 h-3.5 w-3.5 text-[#7A8780]" /><input value={tags} onChange={event => setTags(event.target.value)} placeholder="What is this about? Add up to 3 tags" className="min-w-0 flex-1 py-2.5 text-xs outline-none" /></div>

        {selectedDeck && <ComposerDeckPreview deck={selectedDeck} color={deckColor} onRemove={() => setDeckId("")} onChange={() => setDeckPickerOpen(true)} />}

        <div className="mt-5 flex items-center justify-between border-t border-[#D8DCD3] pt-4">
          <div className="flex items-center gap-1">
            <label title="Add images" className="flex cursor-pointer items-center justify-center rounded-lg p-2.5 text-[#164C3D] hover:bg-[#E8F0E8]"><ImagePlus className="h-5 w-5" /><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={uploading || images.length >= POST_MAX_IMAGES} onChange={event => void pick(event.target.files)} /></label>
            <button type="button" onClick={() => setDeckPickerOpen(value => !value)} title="Link a deck" aria-label="Link a deck" aria-pressed={deckPickerOpen} className={`relative rounded-lg p-2.5 transition hover:bg-[#E8F0E8] ${deckId ? "bg-[#E1EDE5] text-[#164C3D]" : "text-[#164C3D]"}`}><Layers3 className="h-5 w-5" />{deckId && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#C24A3D]" />}</button>
            {uploading && <LoaderCircle className="ml-2 h-4 w-4 animate-spin text-[#164C3D]" />}
          </div>
          <div className="flex gap-2"><button type="button" onClick={() => void cancel()} disabled={sending || uploading} className="rounded-lg border border-[#D8DCD3] px-4 py-2 text-sm font-semibold hover:bg-[#EEF1EB]">Cancel</button><button type="button" onClick={() => void send()} disabled={!valid || sending || uploading} className="flex items-center gap-2 rounded-lg bg-[#164C3D] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Post</button></div>
        </div>
        <p className="mt-3 text-[10px] text-[#7A8780]">Do not upload full copyrighted book or course-material pages.</p>
      </section>
      {deckPickerOpen && <DeckPickerOverlay decks={decks} selectedId={deckId} color={deckColor} onColor={setDeckColor} onSelect={setDeckId} onClose={() => setDeckPickerOpen(false)} />}
    </div>}
  </>;
}

function DeckPickerOverlay({ decks, selectedId, color, onColor, onSelect, onClose }: { decks: Deck[]; selectedId: string; color: DeckCardColor; onColor: (color: DeckCardColor) => void; onSelect: (id: string) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#09100C]/70 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Choose a deck" className="max-h-[85vh] w-full max-w-[760px] overflow-hidden rounded-[22px] border border-[#D8DCD3] bg-[#F9FAF7] shadow-2xl">
      <header className="flex items-center justify-between border-b border-[#D8DCD3] px-6 py-5"><div><h2 className="text-lg font-bold">Choose a deck</h2><p className="mt-1 text-xs text-[#7A8780]">Select one public deck and a card color.</p></div><button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-[#EEF1EB]" aria-label="Close deck picker"><X className="h-5 w-5" /></button></header>
      <div className="border-b border-[#D8DCD3] px-6 py-4"><p className="mb-3 text-xs font-semibold">Card color</p><div className="flex gap-3">{DECK_CARD_COLORS.map(value => { const theme=DECK_CARD_THEMES[value]; return <button key={value} type="button" onClick={() => onColor(value)} aria-label={theme.label} aria-pressed={color===value} className={`h-9 w-9 rounded-full border-2 transition ${color===value?"scale-110 border-[#16241D]":"border-white ring-1 ring-[#C8CEC8]"}`} style={{backgroundColor:theme.folder}} />; })}</div></div>
      <div className="max-h-[55vh] overflow-y-auto p-6"><div className="grid gap-4 sm:grid-cols-2">{decks.map(deck => <DeckChoiceCard key={deck.id} deck={deck} color={color} selected={selectedId===deck.id} onClick={() => onSelect(deck.id)} />)}</div>{!decks.length&&<div className="py-16 text-center text-sm text-[#7A8780]">You do not have a published deck yet.</div>}</div>
      <footer className="flex justify-end gap-2 border-t border-[#D8DCD3] px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-[#D8DCD3] px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={onClose} disabled={!selectedId} className="rounded-lg bg-[#164C3D] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">Attach deck</button></footer>
    </section>
  </div>;
}

function DeckChoiceCard({ deck, color, selected, onClick }: { deck: Deck; color: DeckCardColor; selected: boolean; onClick: () => void }) {
  const theme=DECK_CARD_THEMES[color];
  return <button type="button" onClick={onClick} className={`relative overflow-hidden rounded-2xl border-2 p-3 text-left transition ${selected?"border-[#16241D]":"border-transparent hover:border-[#AEB8AF]"}`} style={{backgroundColor:theme.shell}}>
    <span className="absolute left-5 top-3 h-5 w-20 rounded-t-xl" style={{backgroundColor:theme.tab}} />
    <div className="relative mt-4 min-h-40 rounded-xl border p-4" style={{backgroundColor:theme.folder,borderColor:theme.border,color:theme.ink}}><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest" style={{color:theme.muted}}><Layers3 className="h-3.5 w-3.5"/>Public deck</div><h3 className="mt-3 line-clamp-2 text-lg font-bold">{deck.title}</h3><p className="mt-2 line-clamp-2 text-xs leading-5" style={{color:theme.muted}}>{deck.description}</p></div>
    {selected&&<span className="absolute right-5 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-[#16241D] text-xs text-white">✓</span>}
  </button>;
}

function ComposerDeckPreview({ deck, color, onRemove, onChange }: { deck: Deck; color: DeckCardColor; onRemove: () => void; onChange: () => void }) {
  const theme=DECK_CARD_THEMES[color];
  return <div className="mt-3 rounded-xl border p-3" style={{backgroundColor:theme.shell,borderColor:theme.border}}><div className="flex items-start justify-between gap-3"><button type="button" onClick={onChange} className="min-w-0 flex-1 text-left"><span className="text-[9px] font-bold uppercase tracking-widest text-[#5B6B62]">Attached deck</span><p className="mt-1 truncate text-sm font-bold">{deck.title}</p><p className="mt-1 text-[11px] text-[#5B6B62]">Click to change deck or color</p></button><button type="button" onClick={onRemove} className="rounded-full p-1 hover:bg-white" aria-label="Remove attached deck"><X className="h-4 w-4"/></button></div></div>;
}
