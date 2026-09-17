export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type NoteType = "note" | "qa" | "choice" | "cloze" | "poem" | "vocab";

export type Database = {
  public: {
    Tables: {
      ai_cards: {
        Row: {
          created_at: string;
          edited: boolean;
          fields: Json;
          flags: string[];
          id: string;
          job_id: string;
          layout: string;
          note_id: string | null;
          ord: number;
          owner_id: string;
          sources: Json;
          status: string;
          type: NoteType;
        };
        Insert: {
          created_at?: string;
          edited?: boolean;
          fields?: Json;
          flags?: string[];
          id?: string;
          job_id: string;
          layout?: string;
          note_id?: string | null;
          ord?: number;
          owner_id: string;
          sources?: Json;
          status?: string;
          type: NoteType;
        };
        Update: {
          created_at?: string;
          edited?: boolean;
          fields?: Json;
          flags?: string[];
          id?: string;
          job_id?: string;
          layout?: string;
          note_id?: string | null;
          ord?: number;
          owner_id?: string;
          sources?: Json;
          status?: string;
          type?: NoteType;
        };
        Relationships: [];
      };
      ai_chunks: {
        Row: {
          id: string;
          image_path: string | null;
          job_id: string;
          locator: Json;
          ord: number;
          source_id: string;
          text: string;
          token_estimate: number;
        };
        Insert: {
          id?: string;
          image_path?: string | null;
          job_id: string;
          locator?: Json;
          ord?: number;
          source_id: string;
          text?: string;
          token_estimate?: number;
        };
        Update: {
          id?: string;
          image_path?: string | null;
          job_id?: string;
          locator?: Json;
          ord?: number;
          source_id?: string;
          text?: string;
          token_estimate?: number;
        };
        Relationships: [];
      };
      ai_jobs: {
        Row: {
          created_at: string;
          deck_id: string | null;
          error: string | null;
          id: string;
          instruction: string;
          new_deck_name: string | null;
          outline: Json | null;
          owner_id: string;
          settings: Json;
          stage: Json;
          status: string;
          updated_at: string;
          workflow_run_id: string | null;
        };
        Insert: {
          created_at?: string;
          deck_id?: string | null;
          error?: string | null;
          id?: string;
          instruction?: string;
          new_deck_name?: string | null;
          outline?: Json | null;
          owner_id: string;
          settings?: Json;
          stage?: Json;
          status?: string;
          updated_at?: string;
          workflow_run_id?: string | null;
        };
        Update: {
          created_at?: string;
          deck_id?: string | null;
          error?: string | null;
          id?: string;
          instruction?: string;
          new_deck_name?: string | null;
          outline?: Json | null;
          owner_id?: string;
          settings?: Json;
          stage?: Json;
          status?: string;
          updated_at?: string;
          workflow_run_id?: string | null;
        };
        Relationships: [];
      };
      ai_sources: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          kind: string;
          meta: Json;
          mime: string | null;
          name: string;
          owner_id: string;
          page_range: Json | null;
          size_bytes: number | null;
          sort_order: number;
          status: string;
          storage_path: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          kind: string;
          meta?: Json;
          mime?: string | null;
          name: string;
          owner_id: string;
          page_range?: Json | null;
          size_bytes?: number | null;
          sort_order?: number;
          status?: string;
          storage_path?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          kind?: string;
          meta?: Json;
          mime?: string | null;
          name?: string;
          owner_id?: string;
          page_range?: Json | null;
          size_bytes?: number | null;
          sort_order?: number;
          status?: string;
          storage_path?: string | null;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          cache_hit_tokens: number;
          completion_tokens: number;
          created_at: string;
          id: string;
          job_id: string | null;
          model: string;
          owner_id: string;
          prompt_tokens: number;
        };
        Insert: {
          cache_hit_tokens?: number;
          completion_tokens?: number;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          model: string;
          owner_id: string;
          prompt_tokens?: number;
        };
        Update: {
          cache_hit_tokens?: number;
          completion_tokens?: number;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          model?: string;
          owner_id?: string;
          prompt_tokens?: number;
        };
        Relationships: [];
      };
      book_notes: {
        Row: {
          book_id: string;
          chapter: string | null;
          fields: Json;
          id: string;
          importance: string;
          sort_order: number;
          type: NoteType;
        };
        Insert: {
          book_id: string;
          chapter?: string | null;
          fields?: Json;
          id?: string;
          importance?: string;
          sort_order?: number;
          type: NoteType;
        };
        Update: {
          book_id?: string;
          chapter?: string | null;
          fields?: Json;
          id?: string;
          importance?: string;
          sort_order?: number;
          type?: NoteType;
        };
        Relationships: [];
      };
      books: {
        Row: {
          author: string | null;
          category: string;
          cover: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_free: boolean;
          learner_count: number;
          price_cents: number | null;
          title: string;
          toc: Json;
        };
        Insert: {
          author?: string | null;
          category?: string;
          cover?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_free?: boolean;
          learner_count?: number;
          price_cents?: number | null;
          title: string;
          toc?: Json;
        };
        Update: {
          author?: string | null;
          category?: string;
          cover?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_free?: boolean;
          learner_count?: number;
          price_cents?: number | null;
          title?: string;
          toc?: Json;
        };
        Relationships: [];
      };
      cards: {
        Row: {
          created_at: string;
          deck_id: string;
          difficulty: number;
          due: string;
          elapsed_days: number;
          id: string;
          lapses: number;
          last_review: string | null;
          learning_steps: number;
          note_id: string;
          ord: number;
          owner_id: string;
          reps: number;
          scheduled_days: number;
          stability: number;
          starred: boolean;
          state: number;
          suspended: boolean;
        };
        Insert: {
          created_at?: string;
          deck_id: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          id?: string;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          note_id: string;
          ord?: number;
          owner_id: string;
          reps?: number;
          scheduled_days?: number;
          stability?: number;
          starred?: boolean;
          state?: number;
          suspended?: boolean;
        };
        Update: {
          created_at?: string;
          deck_id?: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          id?: string;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          note_id?: string;
          ord?: number;
          owner_id?: string;
          reps?: number;
          scheduled_days?: number;
          stability?: number;
          starred?: boolean;
          state?: number;
          suspended?: boolean;
        };
        Relationships: [];
      };
      daily_stats: {
        Row: {
          date: string;
          new_cards: number;
          owner_id: string;
          reviews: number;
          study_seconds: number;
        };
        Insert: {
          date: string;
          new_cards?: number;
          owner_id: string;
          reviews?: number;
          study_seconds?: number;
        };
        Update: {
          date?: string;
          new_cards?: number;
          owner_id?: string;
          reviews?: number;
          study_seconds?: number;
        };
        Relationships: [];
      };
      decks: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string;
          id: string;
          name: string;
          owner_id: string;
          source_book_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          name: string;
          owner_id: string;
          source_book_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          source_book_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          owner_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          owner_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          created_at: string;
          deck_id: string;
          fields: Json;
          id: string;
          layout: string;
          owner_id: string;
          source: Json | null;
          tags: string[];
          type: NoteType;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deck_id: string;
          fields?: Json;
          id?: string;
          layout?: string;
          owner_id: string;
          source?: Json | null;
          tags?: string[];
          type: NoteType;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deck_id?: string;
          fields?: Json;
          id?: string;
          layout?: string;
          owner_id?: string;
          source?: Json | null;
          tags?: string[];
          type?: NoteType;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          id: string;
          nickname: string;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          nickname?: string;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          nickname?: string;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_logs: {
        Row: {
          card_id: string;
          difficulty: number | null;
          due: string;
          duration_ms: number;
          elapsed_days: number;
          id: string;
          owner_id: string;
          rating: number;
          review_at: string;
          scheduled_days: number;
          stability: number | null;
          state: number;
        };
        Insert: {
          card_id: string;
          difficulty?: number | null;
          due: string;
          duration_ms?: number;
          elapsed_days?: number;
          id?: string;
          owner_id: string;
          rating: number;
          review_at?: string;
          scheduled_days?: number;
          stability?: number | null;
          state: number;
        };
        Update: {
          card_id?: string;
          difficulty?: number | null;
          due?: string;
          duration_ms?: number;
          elapsed_days?: number;
          id?: string;
          owner_id?: string;
          rating?: number;
          review_at?: string;
          scheduled_days?: number;
          stability?: number | null;
          state?: number;
        };
        Relationships: [];
      };
      user_books: {
        Row: {
          book_id: string;
          deck_id: string | null;
          joined_at: string;
          owner_id: string;
        };
        Insert: {
          book_id: string;
          deck_id?: string | null;
          joined_at?: string;
          owner_id: string;
        };
        Update: {
          book_id?: string;
          deck_id?: string | null;
          joined_at?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      import_ai_cards: { Args: { p_card_ids: string[]; p_job_id: string }; Returns: string };
      join_book: { Args: { p_book_id: string }; Returns: string };
      save_note: {
        Args: {
          p_deck_id: string;
          p_fields: Json;
          p_layout?: string;
          p_note_id?: string | null;
          p_source?: Json;
          p_tags?: string[];
          p_type: NoteType;
        };
        Returns: string;
      };
    };
    Enums: {
      note_type: NoteType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
