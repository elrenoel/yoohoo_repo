"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/session-provider";
import { useLanguage } from "@/hooks/use-language";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserDocument {
  isRagDocument?: boolean;
  hasFlashcards?: boolean;
  id: string;
  title: string;
  createdAt: string;
  isStarred: boolean;
  starredAt?: string | null;
  lastAttempt?: { score: number; total: number; createdAt: string } | null;
  updatedAt?: string;
  materialCount?: number;
  elementCount?: number;
  processingCount?: number;
}

// ── API functions ────────────────────────────────────────────────────────────

async function fetchDocuments(): Promise<UserDocument[]> {
  const res = await fetch("/api/documents");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch documents");
  }
  const data = await res.json();
  return data.documents || [];
}

async function renameDocument(
  id: string,
  title: string
): Promise<{ document: { title: string } }> {
  const res = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to rename document");
  }
  return res.json();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDocuments() {
  const queryClient = useQueryClient();
  const { data: session, isPending: isSessionPending } = useSession();
  const { t } = useLanguage();

  // ── Fetch documents ──────────────────────────────────────────────────────
  const {
    data: documentsList = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.documents,
    queryFn: fetchDocuments,
    enabled: !isSessionPending && !!session?.user,
    staleTime: 5 * 60 * 1000,
  });

  // ── Rename state ─────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const startRename = useCallback((doc: UserDocument) => {
    setEditingId(doc.id);
    setEditingTitle(doc.title);
    setRenameError(null);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
    setRenameError(null);
  }, []);

  // ── Rename mutation ──────────────────────────────────────────────────────
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameDocument(id, title),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<UserDocument[]>(
        queryKeys.documents,
        (old) =>
          old?.map((d) =>
            d.id === variables.id
              ? { ...d, title: data?.document?.title ?? variables.title }
              : d
          ) ?? []
      );
      cancelRename();
    },
    onError: (err: Error) => {
      setRenameError(err.message || t("history.renameError"));
    },
    onSettled: () => {
      renameMutation.reset();
    },
  });

  const starMutation = useMutation({
    mutationFn: async ({ id, isStarred }: { id: string; isStarred: boolean }) => {
      const res = await fetch(`/api/documents/${id}/star`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_starred: isStarred }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Gagal mengubah tanda bintang.");
      return body as { isStarred: boolean; starredAt: string | null };
    },
    onMutate: async ({ id, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.documents });
      const previous = queryClient.getQueryData<UserDocument[]>(queryKeys.documents);
      queryClient.setQueryData<UserDocument[]>(queryKeys.documents, old => old?.map(doc => doc.id === id ? { ...doc, isStarred } : doc) ?? []);
      return { previous };
    },
    onError: (_error, _variables, context) => { if (context?.previous) queryClient.setQueryData(queryKeys.documents, context.previous); },
    onSuccess: (data, variables) => { queryClient.setQueryData<UserDocument[]>(queryKeys.documents, old => old?.map(doc => doc.id === variables.id ? { ...doc, isStarred: data.isStarred, starredAt: data.starredAt } : doc) ?? []); queryClient.invalidateQueries({ queryKey: queryKeys.documents }); },
  });

  const handleRenameSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingId) return;

      const newTitle = editingTitle.trim();
      if (!newTitle) {
        setRenameError(
          t("history.renamePlaceholder") +
            " " +
            t("error.defaultMessage").split(".")[0]
        );
        return;
      }

      const current = documentsList.find((d) => d.id === editingId);
      if (current && current.title === newTitle) {
        cancelRename();
        return;
      }

      setRenameError(null);
      renameMutation.mutate({ id: editingId, title: newTitle });
    },
    [editingId, editingTitle, documentsList, cancelRename, renameMutation, t]
  );

  // ── Delete (soft) state & mutation ───────────────────────────────────────
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete document");
      }
      return res.json();
    },
    onSuccess: (_data, docId) => {
      queryClient.setQueryData<UserDocument[]>(
        queryKeys.documents,
        (old) => old?.filter((d) => d.id !== docId) ?? []
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.trash });
      setDeleteTargetId(null);
      setDeleteTargetTitle("");
    },
  });

  const requestDelete = useCallback((doc: UserDocument) => {
    setDeleteTargetId(doc.id);
    setDeleteTargetTitle(doc.title);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTargetId(null);
    setDeleteTargetTitle("");
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
  }, [deleteTargetId, deleteMutation]);

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents });
  }, [queryClient]);

  return {
    // Data
    documentsList,
    isLoading,
    error,
    // Rename
    editingId,
    editingTitle,
    setEditingTitle,
    renameError,
    startRename,
    cancelRename,
    handleRenameSubmit,
    isRenaming: renameMutation.isPending,
    toggleStar: (doc: UserDocument) => starMutation.mutate({ id: doc.id, isStarred: !doc.isStarred }),
    isStarring: starMutation.isPending,
    // Delete
    deleteTargetId,
    deleteTargetTitle,
    requestDelete,
    cancelDelete,
    confirmDelete,
    isDeleting: deleteMutation.isPending,
    // Misc
    handleRetry,
  };
}
