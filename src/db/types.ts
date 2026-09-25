// Generated-style Supabase types. Refresh with `npm run db:types` after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      user: Table<{ id: string; name: string; email: string; email_verified: boolean; image: string | null; created_at: string; updated_at: string; generation_count_today: number; last_generation_date: string | null }>;
      session: Table<Record<string, Json>>;
      account: Table<Record<string, Json>>;
      verification: Table<Record<string, Json>>;
      documents: Table<{ id: string; user_id: string; title: string; raw_text: string; session_id: string | null; created_at: string; deleted_at: string | null; content_language: string | null; storage_path: string | null; file_size: number | null; page_count: number | null; status: string; error_message: string | null }, { id?: string; user_id: string; title: string; raw_text: string; session_id?: string | null; created_at?: string; deleted_at?: string | null; content_language?: string | null; storage_path?: string | null; file_size?: number | null; page_count?: number | null; status?: string; error_message?: string | null }>;
      document_chunks: Table<{ id: string; document_id: string; chunk_index: number; page_start: number | null; page_end: number | null; content: string; embedding: string | null; scan_pages: Json; processed_at: string | null; processing_error: string | null; created_at: string }>;
      candidate_keywords: Table<{ id: string; document_id: string; chunk_id: string | null; term: string; snippet: string | null; is_selected: boolean; created_at: string }>;
      generation_jobs: Table<{ id: string; document_id: string; user_id: string; selected_keyword_ids: string[]; status: string; expected_items: number; quota_count: number; remaining_quota: number; flashcard_count: number; quiz_count: number; error_message: string | null; created_at: string; started_at: string | null; completed_at: string | null }>;
      generation_job_items: Table<{ id: string; job_id: string; chunk_id: string; status: string; flashcards: Json | null; questions: Json | null; error_message: string | null; created_at: string; updated_at: string }>;
      flashcards: Table<{ id: string; document_id: string; term: string; definition: string }, { id?: string; document_id: string; term: string; definition: string }>;
      quiz_sets: Table<{ id: string; document_id: string; label: string; created_at: string }, { id?: string; document_id: string; label: string; created_at?: string }>;
      quiz_questions: Table<{ id: string; document_id: string; quiz_set_id: string; question: string; options: Json; correct_index: number }, { id?: string; document_id: string; quiz_set_id: string; question: string; options: Json; correct_index: number }>;
      quiz_attempts: Table<{ id: string; document_id: string; session_id: string | null; score: number; total: number; answers: Json; quiz_set_id: string; created_at: string }, { id?: string; document_id: string; session_id?: string | null; score: number; total: number; answers: Json; quiz_set_id: string; created_at?: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_generated_document: { Args: { p_user_id: string; p_title: string; p_raw_text: string; p_content_language: string; p_flashcards: Json; p_questions: Json; p_daily_limit: number }; Returns: Json };
      create_quiz_set: { Args: { p_user_id: string; p_document_id: string; p_label: string | null; p_questions: Json; p_daily_limit: number }; Returns: Json };
      replace_generated_content: { Args: { p_user_id: string; p_document_id: string; p_flashcards: Json; p_questions: Json }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
