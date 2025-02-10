export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          preferences: string[]
          created_at: string
        }
        Insert: {
          id: string
          email: string
          preferences?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          preferences?: string[]
          created_at?: string
        }
      }
      facts: {
        Row: {
          id: string
          content: string
          topic: string
          created_at: string
        }
        Insert: {
          content: string
          topic: string
          created_at?: string
        }
        Update: {
          content?: string
          topic?: string
          created_at?: string
        }
      }
      user_interactions: {
        Row: {
          id: string
          user_id: string
          fact_id: string
          interaction_type: 'dislike' | 'like' | 'love'
          created_at: string
        }
        Insert: {
          user_id: string
          fact_id: string
          interaction_type: 'dislike' | 'like' | 'love'
          created_at?: string
        }
        Update: {
          user_id?: string
          fact_id?: string
          interaction_type?: 'dislike' | 'like' | 'love'
          created_at?: string
        }
      }
    }
  }
} 