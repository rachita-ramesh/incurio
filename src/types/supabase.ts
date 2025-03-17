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
          preferences: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          preferences?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          preferences?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      sparks: {
        Row: {
          id: string
          user_id: string
          content: string
          topic: string
          details: string
          is_curiosity_trail: boolean
          recommendation: Json
          created_at: string
        }
        Insert: {
          user_id: string
          content: string
          topic: string
          details?: string
          is_curiosity_trail?: boolean
          recommendation?: Json
          created_at?: string
        }
        Update: {
          user_id?: string
          content?: string
          topic?: string
          details?: string
          is_curiosity_trail?: boolean
          recommendation?: Json
          created_at?: string
        }
      }
      spark_embeddings: {
        Row: {
          spark_id: string
          embedding: any // vector(1536)
          created_at: string
        }
        Insert: {
          spark_id: string
          embedding?: any
          created_at?: string
        }
        Update: {
          spark_id?: string
          embedding?: any
          created_at?: string
        }
      }
      user_interactions: {
        Row: {
          id: string
          user_id: string
          spark_id: string
          interaction_type: 'dislike' | 'like' | 'love'
          created_at: string
        }
        Insert: {
          user_id: string
          spark_id: string
          interaction_type: 'dislike' | 'like' | 'love'
          created_at?: string
        }
        Update: {
          user_id?: string
          spark_id?: string
          interaction_type?: 'dislike' | 'like' | 'love'
          created_at?: string
        }
      }
      curiosity_trails: {
        Row: {
          id: string
          user_id: string
          topic: string
          love_count: number
          last_milestone: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          topic: string
          love_count?: number
          last_milestone?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          topic?: string
          love_count?: number
          last_milestone?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 