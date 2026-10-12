"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { LoaderCircle, Minus, Plus } from "lucide-react";
import { getCroppedBlob } from "@/lib/avatar-crop";

export default function AvatarCropModal({ imageUrl, isGif, onCancel, onApply }: {
  imageUrl: string;
  isGif: boolean;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const complete = useCallback((_area: Area, areaPixels: Area) => setPixels(areaPixels), []);

  async function apply() {
    if (!pixels || processing) return;
    setProcessing(true);
    try { onApply(await getCroppedBlob(imageUrl, pixels)); }
    finally { setProcessing(false); }
  }

  return <div>
    <header className="mb-6 flex items-center justify-between gap-3">
      <button type="button" onClick={onCancel} disabled={processing} className="rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover disabled:opacity-50">Cancel</button>
      <h2 className="text-lg font-bold">Adjust photo</h2>
      <button type="button" onClick={apply} disabled={!pixels || processing} className="inline-flex min-w-16 items-center justify-center gap-2 rounded-lg bg-action-primary px-3 py-2 text-sm font-semibold text-on-action-primary hover:bg-action-primary-hover disabled:opacity-50">
        {processing && <LoaderCircle className="h-4 w-4 animate-spin"/>}Apply
      </button>
    </header>
    <div className="relative h-[min(62vh,420px)] overflow-hidden rounded-xl bg-text">
      <Cropper image={imageUrl} crop={crop} zoom={zoom} minZoom={1} maxZoom={3} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={complete}/>
    </div>
    <div className="mt-5 flex items-center gap-3">
      <button type="button" aria-label="Zoom out" onClick={()=>setZoom(value=>Math.max(1,Number((value-.1).toFixed(2))))} disabled={zoom<=1 || processing} className="rounded-full border border-border p-2 text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"><Minus className="h-4 w-4"/></button>
      <input aria-label="Photo zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event=>setZoom(Number(event.target.value))} disabled={processing} className="h-1 flex-1 cursor-pointer accent-[var(--color-accent)]"/>
      <button type="button" aria-label="Zoom in" onClick={()=>setZoom(value=>Math.min(3,Number((value+.1).toFixed(2))))} disabled={zoom>=3 || processing} className="rounded-full border border-border p-2 text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"><Plus className="h-4 w-4"/></button>
    </div>
    <div className="mt-2 flex justify-between font-mono text-[11px] text-text-muted"><span>1×</span><span>{zoom.toFixed(2)}×</span><span>3×</span></div>
    {isGif && <p className="mt-4 text-center text-xs text-text-secondary">The GIF will be converted to a still image.</p>}
  </div>;
}
