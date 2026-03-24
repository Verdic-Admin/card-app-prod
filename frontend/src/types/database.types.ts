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
      inventory: {
        Row: {
          id: string
          filename: string | null
          player_name: string | null
          team_name: string | null
          year: string | null
          card_number: string | null
          card_set: string | null
          parallel_insert_type: string | null
          high_price: number | null
          low_price: number | null
          avg_price: number | null
          listed_price: number | null
          cost_basis: number | null
          accepts_offers: boolean | null
          image_url: string | null
          back_image_url: string | null
          status: 'available' | 'sold'
          sold_at: string | null
        }
        Insert: {
          id?: string
          filename?: string | null
          player_name?: string | null
          team_name?: string | null
          year?: string | null
          card_number?: string | null
          card_set?: string | null
          parallel_insert_type?: string | null
          high_price?: number | null
          low_price?: number | null
          avg_price?: number | null
          listed_price?: number | null
          cost_basis?: number | null
          accepts_offers?: boolean | null
          image_url?: string | null
          status?: 'available' | 'sold'
        }
        Update: {
          id?: string
          filename?: string | null
          player_name?: string | null
          team_name?: string | null
          year?: string | null
          card_number?: string | null
          card_set?: string | null
          parallel_insert_type?: string | null
          high_price?: number | null
          low_price?: number | null
          avg_price?: number | null
          listed_price?: number | null
          cost_basis?: number | null
          accepts_offers?: boolean | null
          image_url?: string | null
          status?: 'available' | 'sold'
        }
      }
      alpha_projections: {
        Row: {
          id: string
          card_id: string
          is_hub: boolean
          pbi_target: number | null
          c_set: number | null
          m_parallel: number | null
          alpha_f: number | null
          alpha_s: number | null
          afv: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          card_id: string
          is_hub?: boolean
          pbi_target?: number | null
          c_set?: number | null
          m_parallel?: number | null
          alpha_f?: number | null
          alpha_s?: number | null
          afv?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          is_hub?: boolean
          pbi_target?: number | null
          c_set?: number | null
          m_parallel?: number | null
          alpha_f?: number | null
          alpha_s?: number | null
          afv?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      trade_offers: {
        Row: {
          id: string
          created_at: string
          buyer_name: string
          buyer_email: string
          offer_text: string
          target_items: Json
          attached_image_url: string | null
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          buyer_name: string
          buyer_email: string
          offer_text: string
          target_items: Json
          attached_image_url?: string | null
          status?: string
        }
        Update: {
          id?: string
          created_at?: string
          buyer_name?: string
          buyer_email?: string
          offer_text?: string
          target_items?: Json
          attached_image_url?: string | null
          status?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
