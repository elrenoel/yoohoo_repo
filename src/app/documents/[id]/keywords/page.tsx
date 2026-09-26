"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCheck,
  FileSearch,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ErrorStateLoadFailed } from "@/components/ui/ErrorState";

type Keyword = {
  id: string;
  term: string;
  snippet: string | null;
  isSelected: boolean;
};

type DocumentStatus =
  | "uploaded"
  | "chunking"
  | "indexing"
  | "ready_for_selection"
  | "failed";

type Snapshot = {
  document: {
    title: string;
    status: DocumentStatus;
    pageCount: number | null;
    errorMessage: string | null;
  };
  progress: { total: number; completed: number; skipped: number };
  keywords: Keyword[];
};

const statusLabels: Record<DocumentStatus, string> = {
  uploaded: "Menyiapkan dokumen...",
  chunking: "Membaca dan memecah materi...",
  indexing: "Menganalisis konten...",
  ready_for_selection: "Keyword siap dipilih",
  failed: "Pemrosesan dokumen gagal",
};

function apiMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export default function KeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [confirmLargeSelection, setConfirmLargeSelection] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/documents/${id}/keywords`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const body = await readJson(response);
        if (!response.ok) throw new Error(apiMessage(body, "Keyword tidak dapat dimuat."));
        if (cancelled) return;

        const snapshot = body as Snapshot;
        setData(snapshot);
        setError("");
        setLoading(false);

        if (snapshot.document.status === "ready_for_selection") {
          setSelected(new Set(snapshot.keywords.filter((keyword) => keyword.isSelected).map((keyword) => keyword.id)));
          return;
        }
        if (snapshot.document.status !== "failed") {
          timer = setTimeout(load, 3_000);
        }
      } catch (loadError) {
        if (cancelled || controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Keyword tidak dapat dimuat.");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [id, retry]);

  const filteredKeywords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    if (!query || !data) return data?.keywords ?? [];
    return data.keywords.filter((keyword) => keyword.term.toLocaleLowerCase("id-ID").includes(query));
  }, [data, search]);

  function toggleKeyword(keywordId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(keywordId);
      else next.delete(keywordId);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    setSelected((current) =>
      current.size === data.keywords.length
        ? new Set()
        : new Set(data.keywords.map((keyword) => keyword.id)),
    );
  }

  async function saveAndContinue() {
    if (!selected.size || saving) return;
    setSaving(true);
    setError("");
    const selectedIds = [...selected];

    try {
      const response = await fetch(`/api/documents/${id}/keywords`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIds }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(apiMessage(body, "Pilihan keyword gagal disimpan."));

      console.info("Keyword terpilih untuk tahap generate flashcard:", selectedIds);
      router.push(`/documents/${id}/generate-flashcards?selected=${selectedIds.length}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Pilihan keyword gagal disimpan.");
      setSaving(false);
    }
  }

  function requestContinue() {
    if (!selected.size || saving) return;
    if (selected.size > 30) {
      setConfirmLargeSelection(true);
      return;
    }
    void saveAndContinue();
  }

  function retryLoad() {
    setLoading(true);
    setError("");
    setRetry((value) => value + 1);
  }

  const title = data?.document.title ?? "Pilih keyword";
  const status = data?.document.status;
  const keywords = data?.keywords ?? [];
  const allSelected = keywords.length > 0 && selected.size === keywords.length;

  return (
    <>
      <Navbar
        backHref="/history"
        title={title}
        subtitle={data?.document.pageCount ? `${data.document.pageCount} halaman` : undefined}
      />
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1">
        {loading && (
          <div className="space-y-5" aria-busy="true" aria-label="Memuat keyword">
            <div className="space-y-2">
              <div className="h-8 w-64 max-w-full rounded-lg bg-neutral-200 animate-pulse" />
              <div className="h-4 w-96 max-w-full rounded bg-neutral-100 animate-pulse" />
            </div>
            {[0, 1, 2].map((item) => (
              <Card key={item} variant="compact" className="flex gap-4">
                <div className="h-5 w-5 rounded bg-neutral-200 animate-pulse shrink-0" />
                <div className="w-full space-y-3">
                  <div className="h-4 w-1/3 rounded bg-neutral-200 animate-pulse" />
                  <div className="h-3 w-full rounded bg-neutral-100 animate-pulse" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {!loading && error && !data && (
          <ErrorStateLoadFailed
            title="Keyword belum dapat dimuat"
            message={error}
            onRetry={retryLoad}
          />
        )}

        {!loading && data && status !== "ready_for_selection" && (
          <Card className="max-w-xl mx-auto text-center">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${status === "failed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
              {status === "failed" ? <AlertCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">{statusLabels[status!]}</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {status === "failed"
                ? data.document.errorMessage || "Sistem tidak berhasil mengambil keyword dari dokumen ini."
                : "Halaman ini akan diperbarui otomatis saat daftar keyword sudah siap."}
            </p>
            {data.progress.total > 0 && status !== "failed" && (
              <p className="mt-4 text-xs font-mono text-neutral-500">
                {data.progress.completed} dari {data.progress.total} bagian selesai
              </p>
            )}
            {status === "failed" && (
              <Link href="/app" className="mt-6 inline-flex rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition">
                Upload PDF lain
              </Link>
            )}
          </Card>
        )}

        {!loading && data && status === "ready_for_selection" && keywords.length === 0 && (
          <Card variant="centered" className="max-w-xl mx-auto">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600">
              <FileSearch className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">Tidak ada keyword yang ditemukan</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Coba gunakan PDF dengan teks yang lebih jelas atau upload dokumen lain untuk dianalisis kembali.
            </p>
            <Link href="/app" className="mt-6 inline-flex rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition">
              Upload PDF lain
            </Link>
          </Card>
        )}

        {!loading && data && status === "ready_for_selection" && keywords.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-2">Konsep penting</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">Pilih materi yang ingin dipelajari</h1>
                <p className="mt-2 text-sm text-neutral-600">Baca konteks setiap istilah, lalu centang yang ingin dijadikan flashcard.</p>
              </div>
              <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-xs shrink-0" aria-live="polite">
                <span className="font-semibold text-neutral-900">{selected.size}</span> dari {keywords.length} dipilih
              </div>
            </div>

            <Card variant="compact" className="space-y-4">
              {keywords.length > 20 && (
                <label className="relative block">
                  <span className="sr-only">Cari keyword</span>
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari keyword..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
                  />
                </label>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="secondary" onClick={toggleAll} disabled={saving}>
                  <CheckCheck className="w-4 h-4" />
                  {allSelected ? "Batalkan semua" : "Pilih semua"}
                </Button>
                {search && (
                  <p className="text-xs text-neutral-500">
                    Menampilkan {filteredKeywords.length} dari {keywords.length} keyword
                  </p>
                )}
              </div>
            </Card>

            {filteredKeywords.length > 0 ? (
              <div className="space-y-3">
                {filteredKeywords.map((keyword) => {
                  const checked = selected.has(keyword.id);
                  return (
                    <label
                      key={keyword.id}
                      className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-5 shadow-2xs transition ${checked ? "border-emerald-300 bg-emerald-50/60" : "border-neutral-200 bg-white hover:border-neutral-400"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={(event) => toggleKeyword(keyword.id, event.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-neutral-900">{keyword.term}</span>
                        <span className="mt-1.5 block text-sm leading-relaxed text-neutral-600">
                          {keyword.snippet || "Cuplikan konteks tidak tersedia untuk keyword ini."}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <Card variant="centered">
                <FileSearch className="mx-auto h-5 w-5 text-neutral-500" />
                <p className="mt-3 text-sm font-medium text-neutral-900">Keyword tidak ditemukan</p>
                <p className="mt-1 text-xs text-neutral-500">Coba gunakan kata pencarian lain.</p>
              </Card>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="sticky bottom-4 z-10 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:flex sm:items-center sm:justify-between">
              <p className="mb-3 text-xs text-neutral-500 sm:mb-0">
                Pilihan baru disimpan saat kamu melanjutkan.
              </p>
              <Button
                variant="success"
                size="lg"
                disabled={selected.size === 0 || saving}
                onClick={requestContinue}
                className="w-full sm:w-auto"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {saving ? "Menyimpan pilihan..." : "Lanjut buat flashcard"}
              </Button>
            </div>
          </div>
        )}
      </main>
      {confirmLargeSelection && (
        <ConfirmDialog
          title="Buat materi untuk banyak keyword?"
          message={`${selected.size} keyword akan dibuat dalam beberapa batch agar hemat kuota Gemini. Prosesnya dapat memerlukan beberapa menit.`}
          confirmLabel="Lanjutkan generate"
          confirmVariant="success"
          icon={<Sparkles className="w-4 h-4" />}
          onCancel={() => setConfirmLargeSelection(false)}
          onConfirm={() => { setConfirmLargeSelection(false); void saveAndContinue(); }}
        />
      )}
    </>
  );
}
