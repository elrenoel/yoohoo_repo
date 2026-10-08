export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          account_id: string
          created_at: string
          id: string
          id_token: string | null
          password: string | null
          provider_id: string
          refresh_token: string | null
          refresh_token_expires_at: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_id: string
          created_at?: string
          id: string
          id_token?: string | null
          password?: string | null
          provider_id: string
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_id?: string
          created_at?: string
          id?: string
          id_token?: string | null
          password?: string | null
          provider_id?: string
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_keywords: {
        Row: {
          chunk_id: string | null
          content_type: string | null
          core_overridden_by_user: boolean
          created_at: string | null
          document_id: string | null
          id: string
          importance_score: number | null
          is_core: boolean
          is_selected: boolean | null
          snippet: string | null
          term: string
          topic_label: string | null
          why_important: string | null
        }
        Insert: {
          chunk_id?: string | null
          content_type?: string | null
          core_overridden_by_user?: boolean
          created_at?: string | null
          document_id?: string | null
          id?: string
          importance_score?: number | null
          is_core?: boolean
          is_selected?: boolean | null
          snippet?: string | null
          term: string
          topic_label?: string | null
          why_important?: string | null
        }
        Update: {
          chunk_id?: string | null
          content_type?: string | null
          core_overridden_by_user?: boolean
          created_at?: string | null
          document_id?: string | null
          id?: string
          importance_score?: number | null
          is_core?: boolean
          is_selected?: boolean | null
          snippet?: string | null
          term?: string
          topic_label?: string | null
          why_important?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_keywords_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_keywords_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_documents: {
        Row: {
          added_at: string
          deck_id: string
          document_id: string
        }
        Insert: {
          added_at?: string
          deck_id: string
          document_id: string
        }
        Update: {
          added_at?: string
          deck_id?: string
          document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_documents_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_priority: boolean
          is_starred: boolean
          starred_at: string | null
          study_goal: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_priority?: boolean
          is_starred?: boolean
          starred_at?: string | null
          study_goal?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_priority?: boolean
          is_starred?: boolean
          starred_at?: string | null
          study_goal?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          id: string
          page_end: number | null
          page_start: number | null
          processed_at: string | null
          processing_error: string | null
          scan_pages: Json
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          processed_at?: string | null
          processing_error?: string | null
          scan_pages?: Json
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          processed_at?: string | null
          processing_error?: string | null
          scan_pages?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content_language: string | null
          created_at: string
          deleted_at: string | null
          document_summary: string | null
          error_message: string | null
          file_size: number | null
          id: string
          is_starred: boolean
          page_count: number | null
          raw_text: string
          session_id: string | null
          starred_at: string | null
          status: string
          storage_path: string | null
          title: string
          user_id: string
        }
        Insert: {
          content_language?: string | null
          created_at?: string
          deleted_at?: string | null
          document_summary?: string | null
          error_message?: string | null
          file_size?: number | null
          id?: string
          is_starred?: boolean
          page_count?: number | null
          raw_text: string
          session_id?: string | null
          starred_at?: string | null
          status?: string
          storage_path?: string | null
          title: string
          user_id: string
        }
        Update: {
          content_language?: string | null
          created_at?: string
          deleted_at?: string | null
          document_summary?: string | null
          error_message?: string | null
          file_size?: number | null
          id?: string
          is_starred?: boolean
          page_count?: number | null
          raw_text?: string
          session_id?: string | null
          starred_at?: string | null
          status?: string
          storage_path?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_relations: {
        Row: {
          created_at: string
          from_flashcard_id: string
          id: string
          relation_type: string
          source_chunk_id: string | null
          suggested_term: string | null
          to_flashcard_id: string | null
        }
        Insert: {
          created_at?: string
          from_flashcard_id: string
          id?: string
          relation_type?: string
          source_chunk_id?: string | null
          suggested_term?: string | null
          to_flashcard_id?: string | null
        }
        Update: {
          created_at?: string
          from_flashcard_id?: string
          id?: string
          relation_type?: string
          source_chunk_id?: string | null
          suggested_term?: string | null
          to_flashcard_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_relations_from_flashcard_id_fkey"
            columns: ["from_flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_relations_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_relations_to_flashcard_id_fkey"
            columns: ["to_flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          blob_variant: number
          deck_id: string | null
          definition: string
          document_id: string
          id: string
          job_id: string | null
          keyword_id: string | null
          term: string
        }
        Insert: {
          blob_variant?: number
          deck_id?: string | null
          definition: string
          document_id: string
          id?: string
          job_id?: string | null
          keyword_id?: string | null
          term: string
        }
        Update: {
          blob_variant?: number
          deck_id?: string | null
          definition?: string
          document_id?: string
          id?: string
          job_id?: string | null
          keyword_id?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_document_id_documents_id_fk"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "candidate_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_job_items: {
        Row: {
          batch_index: number
          chunk_id: string | null
          created_at: string
          document_id: string | null
          error_message: string | null
          flashcards: Json | null
          id: string
          job_id: string
          keyword_id: string | null
          keyword_ids: string[]
          questions: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_index: number
          chunk_id?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          flashcards?: Json | null
          id?: string
          job_id: string
          keyword_id?: string | null
          keyword_ids?: string[]
          questions?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_index?: number
          chunk_id?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          flashcards?: Json | null
          id?: string
          job_id?: string
          keyword_id?: string | null
          keyword_ids?: string[]
          questions?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_job_items_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_job_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_job_items_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "candidate_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          deck_id: string | null
          document_id: string | null
          error_message: string | null
          expected_items: number
          finished_at: string | null
          flashcard_count: number
          id: string
          idempotency_key: string
          input: Json | null
          kind: string | null
          quiz_count: number
          quota_count: number
          remaining_quota: number
          result: Json | null
          selected_keyword_ids: string[]
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          deck_id?: string | null
          document_id?: string | null
          error_message?: string | null
          expected_items: number
          finished_at?: string | null
          flashcard_count?: number
          id?: string
          idempotency_key: string
          input?: Json | null
          kind?: string | null
          quiz_count?: number
          quota_count: number
          remaining_quota: number
          result?: Json | null
          selected_keyword_ids: string[]
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          deck_id?: string | null
          document_id?: string | null
          error_message?: string | null
          expected_items?: number
          finished_at?: string | null
          flashcard_count?: number
          id?: string
          idempotency_key?: string
          input?: Json | null
          kind?: string | null
          quiz_count?: number
          quota_count?: number
          remaining_quota?: number
          result?: Json | null
          selected_keyword_ids?: string[]
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_quota_events: {
        Row: {
          created_at: string
          document_id: string | null
          event_key: string
          id: string
          kind: string
          quiz_set_id: string | null
          quota_count: number
          quota_date: string
          remaining_quota: number
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          event_key: string
          id?: string
          kind: string
          quiz_set_id?: string | null
          quota_count: number
          quota_date: string
          remaining_quota: number
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          event_key?: string
          id?: string
          kind?: string
          quiz_set_id?: string | null
          quota_count?: number
          quota_date?: string
          remaining_quota?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_quota_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_quota_events_quiz_set_id_fkey"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_quota_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_progress: {
        Row: {
          created_at: string
          keyword_id: string
          last_studied_at: string | null
          score: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          keyword_id: string
          last_studied_at?: string | null
          score?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          keyword_id?: string
          last_studied_at?: string | null
          score?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_progress_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "candidate_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_relations: {
        Row: {
          created_at: string
          document_id: string
          from_keyword_id: string
          id: string
          relation_type: string
          to_keyword_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          from_keyword_id: string
          id?: string
          relation_type: string
          to_keyword_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          from_keyword_id?: string
          id?: string
          relation_type?: string
          to_keyword_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_relations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_relations_from_keyword_id_fkey"
            columns: ["from_keyword_id"]
            isOneToOne: false
            referencedRelation: "candidate_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_relations_to_keyword_id_fkey"
            columns: ["to_keyword_id"]
            isOneToOne: false
            referencedRelation: "candidate_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          dedupe_key: string
          id: string
          job_id: string | null
          link: string | null
          read_at: string | null
          severity: string | null
          title: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          dedupe_key: string
          id?: string
          job_id?: string | null
          link?: string | null
          read_at?: string | null
          severity?: string | null
          title?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          dedupe_key?: string
          id?: string
          job_id?: string | null
          link?: string | null
          read_at?: string | null
          severity?: string | null
          title?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempt_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_index: number | null
          status: string
          time_taken_ms: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_index?: number | null
          status: string
          time_taken_ms?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_index?: number | null
          status?: string
          time_taken_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          document_id: string
          id: string
          mode: string
          quiz_set_id: string
          score: number
          session_id: string | null
          total: number
          total_time_ms: number | null
          user_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          document_id: string
          id?: string
          mode?: string
          quiz_set_id: string
          score: number
          session_id?: string | null
          total: number
          total_time_ms?: number | null
          user_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          document_id?: string
          id?: string
          mode?: string
          quiz_set_id?: string
          score?: number
          session_id?: string | null
          total?: number
          total_time_ms?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_document_id_documents_id_fk"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_set_id_quiz_sets_id_fk"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_index: number
          difficulty: string
          document_id: string
          explanation: string | null
          id: string
          options: Json
          question: string
          quiz_set_id: string
        }
        Insert: {
          correct_index: number
          difficulty?: string
          document_id: string
          explanation?: string | null
          id?: string
          options: Json
          question: string
          quiz_set_id: string
        }
        Update: {
          correct_index?: number
          difficulty?: string
          document_id?: string
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          quiz_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_document_id_documents_id_fk"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_set_id_quiz_sets_id_fk"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sets: {
        Row: {
          created_at: string
          document_id: string
          id: string
          job_id: string | null
          label: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          job_id?: string | null
          label: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          job_id?: string | null
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sets_document_id_documents_id_fk"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id: string
          ip_address?: string | null
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      study_session_items: {
        Row: {
          id: string
          keyword_id: string
          method: string
          payload: Json
          position: number
          result_score: number | null
          session_id: string
          status: string
        }
        Insert: {
          id?: string
          keyword_id: string
          method: string
          payload?: Json
          position: number
          result_score?: number | null
          session_id: string
          status?: string
        }
        Update: {
          id?: string
          keyword_id?: string
          method?: string
          payload?: Json
          position?: number
          result_score?: number | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_session_items_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "candidate_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          deck_id: string
          goal: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deck_id: string
          goal: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deck_id?: string
          goal?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      user: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean
          generation_count_today: number
          id: string
          image: string | null
          last_generation_date: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean
          generation_count_today?: number
          id: string
          image?: string | null
          last_generation_date?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean
          generation_count_today?: number
          id?: string
          image?: string | null
          last_generation_date?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      verification: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          identifier: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id: string
          identifier: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          identifier?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_generation_quota: {
        Args: { p_daily_limit: number; p_user_id: string }
        Returns: {
          new_count: number
          quota_date: string
          remaining: number
        }[]
      }
      create_generated_document: {
        Args: {
          p_content_language: string
          p_daily_limit: number
          p_flashcards: Json
          p_questions: Json
          p_raw_text: string
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      create_quiz_set: {
        Args: {
          p_daily_limit: number
          p_document_id: string
          p_label: string
          p_questions: Json
          p_user_id: string
        }
        Returns: Json
      }
      replace_generated_content: {
        Args: {
          p_document_id: string
          p_flashcards: Json
          p_questions: Json
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
