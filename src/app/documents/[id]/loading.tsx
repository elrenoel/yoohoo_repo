export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-200 border-t-neutral-900 animate-spin" />
        <p className="text-xs text-neutral-400 font-mono">Memuat...</p>
      </div>
    </div>
  );
}
