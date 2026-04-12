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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      coin_requests: {
        Row: {
          id: string
          item_id: string | null
          buyer_email: string
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          item_id?: string | null
          buyer_email: string
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          item_id?: string | null
          buyer_email?: string
          status?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coin_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory: {
        Row: {
          accepts_offers: boolean | null
          auction_status: string | null
          auction_reserve_price: number | null
          auction_end_time: string | null
          auction_description: string | null
          avg_price: number | null
          back_image_url: string | null
          card_number: string | null
          card_set: string | null
          coined_image_url: string | null
          cost_basis: number | null
          created_at: string | null
          current_bid: number | null
          filename: string | null
          high_price: number | null
          id: string
          image_url: string | null
          is_auction: boolean | null
          is_lot: boolean | null
          is_verified_flip: boolean | null
          listed_price: number | null
          lot_id: string | null
          low_price: number | null
          oracle_projection: number | null
          oracle_trend_percentage: number | null
          parallel_insert_type: string | null
          insert_name: string | null
          parallel_name: string | null
          player_name: string | null
          print_run: number | null
          sold_at: string | null
          status: string | null
          team_name: string | null
          verification_code: string | null
          video_url: string | null
        }
        Insert: {
          accepts_offers?: boolean | null
          auction_status?: string | null
          auction_reserve_price?: number | null
          auction_end_time?: string | null
          auction_description?: string | null
          avg_price?: number | null
          back_image_url?: string | null
          card_number?: string | null
          card_set?: string | null
          coined_image_url?: string | null
          cost_basis?: number | null
          current_bid?: number | null
          filename?: string | null
          high_price?: number | null
          id?: string
          image_url?: string | null
          is_auction?: boolean | null
          is_lot?: boolean | null
          is_verified_flip?: boolean | null
          listed_price?: number | null
          lot_id?: string | null
          low_price?: number | null
          oracle_projection?: number | null
          oracle_trend_percentage?: number | null
          parallel_insert_type?: string | null
          insert_name?: string | null
          parallel_name?: string | null
          player_name?: string | null
          print_run?: number | null
          sold_at?: string | null
          status?: string | null
          team_name?: string | null
          verification_code?: string | null
          video_url?: string | null
        }
        Update: {
          accepts_offers?: boolean | null
          auction_status?: string | null
          auction_reserve_price?: number | null
          auction_end_time?: string | null
          auction_description?: string | null
          avg_price?: number | null
          back_image_url?: string | null
          card_number?: string | null
          card_set?: string | null
          coined_image_url?: string | null
          cost_basis?: number | null
          current_bid?: number | null
          filename?: string | null
          high_price?: number | null
          id?: string
          image_url?: string | null
          is_auction?: boolean | null
          is_lot?: boolean | null
          is_verified_flip?: boolean | null
          listed_price?: number | null
          lot_id?: string | null
          low_price?: number | null
          oracle_projection?: number | null
          oracle_trend_percentage?: number | null
          parallel_insert_type?: string | null
          insert_name?: string | null
          parallel_name?: string | null
          player_name?: string | null
          print_run?: number | null
          sold_at?: string | null
          status?: string | null
          team_name?: string | null
          verification_code?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          allow_offers: boolean
          cart_minimum: number
          id: number
          live_stream_url: string | null
          oracle_discount_percentage: number | null
          paypal_email: string
          projection_timeframe: string | null
          site_announcement: string
          social_discord: string | null
          social_facebook: string
          social_instagram: string
          social_threads: string | null
          social_twitter: string
          store_description: string
          updated_at: string | null
        }
        Insert: {
          allow_offers?: boolean
          cart_minimum?: number
          id?: number
          live_stream_url?: string | null
          oracle_discount_percentage?: number | null
          paypal_email?: string
          site_announcement?: string
          social_discord?: string | null
          social_facebook?: string
          social_instagram?: string
          social_threads?: string | null
          social_twitter?: string
          store_description?: string
          updated_at?: string | null
        }
        Update: {
          allow_offers?: boolean
          cart_minimum?: number
          id?: number
          live_stream_url?: string | null
          oracle_discount_percentage?: number | null
          paypal_email?: string
          projection_timeframe?: string | null
          site_announcement?: string
          social_discord?: string | null
          social_facebook?: string
          social_instagram?: string
          social_threads?: string | null
          social_twitter?: string
          store_description?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      trade_offers: {
        Row: {
          attached_image_url: string | null
          buyer_email: string
          buyer_name: string
          created_at: string
          id: string
          offer_text: string
          status: string | null
          target_items: Json
        }
        Insert: {
          attached_image_url?: string | null
          buyer_email: string
          buyer_name: string
          created_at?: string
          id?: string
          offer_text: string
          status?: string | null
          target_items: Json
        }
        Update: {
          attached_image_url?: string | null
          buyer_email?: string
          buyer_name?: string
          created_at?: string
          id?: string
          offer_text?: string
          status?: string | null
          target_items?: Json
        }
        Relationships: []
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
