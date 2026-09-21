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
      admins: {
        Row: {
          active: boolean
          granted_at: string
          granted_by: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_hash: string | null
          metadata: Json
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip_hash?: string | null
          metadata?: Json
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip_hash?: string | null
          metadata?: Json
          request_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          metadata: Json
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          metadata?: Json
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          added_by: string
          channel_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          added_by: string
          channel_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          added_by?: string
          channel_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_profiles: {
        Row: {
          about: string
          channel_id: string
          firebase_uid: string | null
          games: string
          instagram: string
          tiktok: string
          updated_at: string
          website: string
          youtube: string
        }
        Insert: {
          about?: string
          channel_id: string
          firebase_uid?: string | null
          games?: string
          instagram?: string
          tiktok?: string
          updated_at?: string
          website?: string
          youtube?: string
        }
        Update: {
          about?: string
          channel_id?: string
          firebase_uid?: string | null
          games?: string
          instagram?: string
          tiktok?: string
          updated_at?: string
          website?: string
          youtube?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_profiles_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          avatar_url: string
          banner_url: string
          category_id: string | null
          created_at: string
          current_live_id: string | null
          deleted_at: string | null
          description: string
          firebase_id: string | null
          id: string
          is_live: boolean
          name: string
          owner_id: string
          slug: string
          updated_at: string
          visibility: string
        }
        Insert: {
          avatar_url?: string
          banner_url?: string
          category_id?: string | null
          created_at?: string
          current_live_id?: string | null
          deleted_at?: string | null
          description?: string
          firebase_id?: string | null
          id?: string
          is_live?: boolean
          name: string
          owner_id: string
          slug: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          avatar_url?: string
          banner_url?: string
          category_id?: string | null
          created_at?: string
          current_live_id?: string | null
          deleted_at?: string | null
          description?: string
          firebase_id?: string | null
          id?: string
          is_live?: boolean
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_current_live_id_fkey"
            columns: ["current_live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          firebase_id: string | null
          id: string
          live_id: string
          reply_to_id: string | null
          sender_id: string
          status: string
          text: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          firebase_id?: string | null
          id?: string
          live_id: string
          reply_to_id?: string | null
          sender_id: string
          status?: string
          text: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          firebase_id?: string | null
          id?: string
          live_id?: string
          reply_to_id?: string | null
          sender_id?: string
          status?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_settings: {
        Row: {
          allow_links: boolean
          block_excess_caps: boolean
          blocked_words: string[]
          emergency_mode: boolean
          live_id: string
          mode: string
          pinned_message_id: string | null
          slow_mode_seconds: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          allow_links?: boolean
          block_excess_caps?: boolean
          blocked_words?: string[]
          emergency_mode?: boolean
          live_id: string
          mode?: string
          pinned_message_id?: string | null
          slow_mode_seconds?: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          allow_links?: boolean
          block_excess_caps?: boolean
          blocked_words?: string[]
          emergency_mode?: boolean
          live_id?: string
          mode?: string
          pinned_message_id?: string | null
          slow_mode_seconds?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_settings_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: true
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_settings_pinned_message_id_fkey"
            columns: ["pinned_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          created_at: string
          creator_id: string
          deleted_at: string | null
          firebase_id: string | null
          id: string
          live_id: string
          mature_content: boolean
          media_path: string | null
          moment_seconds: number
          source_url: string
          streamer_id: string
          thumbnail_url: string
          title: string
          visibility: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          firebase_id?: string | null
          id?: string
          live_id: string
          mature_content?: boolean
          media_path?: string | null
          moment_seconds: number
          source_url?: string
          streamer_id: string
          thumbnail_url?: string
          title: string
          visibility?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          firebase_id?: string | null
          id?: string
          live_id?: string
          mature_content?: boolean
          media_path?: string | null
          moment_seconds?: number
          source_url?: string
          streamer_id?: string
          thumbnail_url?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "clips_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_promotions: {
        Row: {
          active: boolean
          amount: number
          claim_count: number
          created_at: string
          created_by: string
          description: string
          ends_at: string
          firebase_id: string | null
          id: string
          max_claims: number
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          claim_count?: number
          created_at?: string
          created_by: string
          description?: string
          ends_at: string
          firebase_id?: string | null
          id?: string
          max_claims: number
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          claim_count?: number
          created_at?: string
          created_by?: string
          description?: string
          ends_at?: string
          firebase_id?: string | null
          id?: string
          max_claims?: number
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_attributions: {
        Row: {
          creator_code: string
          creator_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          creator_code: string
          creator_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          creator_code?: string
          creator_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_attributions_creator_code_fkey"
            columns: ["creator_code"]
            isOneToOne: false
            referencedRelation: "creator_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      creator_codes: {
        Row: {
          code: string
          created_at: string
          creator_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          creator_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          creator_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      featured_streamers: {
        Row: {
          active: boolean
          channel_id: string
          created_at: string
          created_by: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          channel_id: string
          created_at?: string
          created_by?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          channel_id?: string
          created_at?: string
          created_by?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "featured_streamers_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      followed_categories: {
        Row: {
          category_id: string
          followed_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          followed_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          followed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followed_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          channel_id: string
          followed_at: string
          follower_id: string
        }
        Insert: {
          channel_id: string
          followed_at?: string
          follower_id: string
        }
        Update: {
          channel_id?: string
          followed_at?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_config: {
        Row: {
          privacy_version: string
          reports_enabled: boolean
          rules_version: string
          singleton: boolean
          terms_effective: boolean
          terms_version: string
          updated_at: string
        }
        Insert: {
          privacy_version: string
          reports_enabled?: boolean
          rules_version: string
          singleton?: boolean
          terms_effective?: boolean
          terms_version: string
          updated_at?: string
        }
        Update: {
          privacy_version?: string
          reports_enabled?: boolean
          rules_version?: string
          singleton?: boolean
          terms_effective?: boolean
          terms_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_bans: {
        Row: {
          banned_by: string
          created_at: string
          expires_at: string | null
          kind: string
          live_id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          expires_at?: string | null
          kind: string
          live_id: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          kind?: string
          live_id?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_bans_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_moderators: {
        Row: {
          added_by: string
          created_at: string
          live_id: string
          user_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          live_id: string
          user_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_moderators_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          expires_at: string
          firebase_id: string | null
          id: string
          live_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          expires_at: string
          firebase_id?: string | null
          id?: string
          live_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          expires_at?: string
          firebase_id?: string | null
          id?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      live_schedules: {
        Row: {
          channel_id: string
          created_at: string
          description: string
          firebase_id: string | null
          id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          description?: string
          firebase_id?: string | null
          id?: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          description?: string
          firebase_id?: string | null
          id?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_schedules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      lives: {
        Row: {
          category_id: string | null
          channel_id: string
          created_at: string
          deleted_at: string | null
          description: string
          ended_at: string | null
          firebase_id: string | null
          host_target_live_id: string | null
          id: string
          mature_content: boolean
          owner_id: string
          playback_url: string
          raid_target_live_id: string | null
          started_at: string | null
          status: string
          support_alert_duration_ms: number | null
          support_alert_min_coins: number | null
          support_alert_sound: string
          support_alert_theme: string | null
          support_goal_coins: number | null
          support_goal_label: string | null
          thumbnail_url: string
          title: string
          total_views: number
          updated_at: string
          visibility: string
          vod_url: string | null
        }
        Insert: {
          category_id?: string | null
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          ended_at?: string | null
          firebase_id?: string | null
          host_target_live_id?: string | null
          id?: string
          mature_content?: boolean
          owner_id: string
          playback_url: string
          raid_target_live_id?: string | null
          started_at?: string | null
          status?: string
          support_alert_duration_ms?: number | null
          support_alert_min_coins?: number | null
          support_alert_sound?: string
          support_alert_theme?: string | null
          support_goal_coins?: number | null
          support_goal_label?: string | null
          thumbnail_url?: string
          title: string
          total_views?: number
          updated_at?: string
          visibility?: string
          vod_url?: string | null
        }
        Update: {
          category_id?: string | null
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          ended_at?: string | null
          firebase_id?: string | null
          host_target_live_id?: string | null
          id?: string
          mature_content?: boolean
          owner_id?: string
          playback_url?: string
          raid_target_live_id?: string | null
          started_at?: string | null
          status?: string
          support_alert_duration_ms?: number | null
          support_alert_min_coins?: number | null
          support_alert_sound?: string
          support_alert_theme?: string | null
          support_goal_coins?: number | null
          support_goal_label?: string | null
          thumbnail_url?: string
          title?: string
          total_views?: number
          updated_at?: string
          visibility?: string
          vod_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lives_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lives_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lives_host_target_live_id_fkey"
            columns: ["host_target_live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lives_raid_target_live_id_fkey"
            columns: ["raid_target_live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          expires_at: string | null
          firebase_id: string | null
          id: string
          moderator_id: string
          penalty_type: string
          reason: string
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          expires_at?: string | null
          firebase_id?: string | null
          id?: string
          moderator_id: string
          penalty_type: string
          reason: string
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string | null
          firebase_id?: string | null
          id?: string
          moderator_id?: string
          penalty_type?: string
          reason?: string
          target_user_id?: string
        }
        Relationships: []
      }
      moderation_audit: {
        Row: {
          action: string
          created_at: string
          firebase_id: string | null
          id: string
          moderator_id: string
          report_id: string
          resolution: string | null
        }
        Insert: {
          action: string
          created_at?: string
          firebase_id?: string | null
          id?: string
          moderator_id: string
          report_id: string
          resolution?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          firebase_id?: string | null
          id?: string
          moderator_id?: string
          report_id?: string
          resolution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_audit_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_penalties: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          expires_at: string | null
          reason: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          expires_at?: string | null
          reason: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          expires_at?: string | null
          reason?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_states: {
        Row: {
          last_seen_at: string
          state_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at: string
          state_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          state_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      policy_acceptances: {
        Row: {
          accepted_at: string
          policy: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          policy: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          policy?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          position: number
          vote_count: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          position: number
          vote_count?: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          position?: number
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string
          firebase_id: string | null
          id: string
          kind: string
          live_id: string
          question: string
          result_option_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          firebase_id?: string | null
          id?: string
          kind: string
          live_id: string
          question: string
          result_option_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          firebase_id?: string | null
          id?: string
          kind?: string
          live_id?: string
          question?: string
          result_option_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_result_option_id_fkey"
            columns: ["result_option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string
          created_at: string
          firebase_uid: string | null
          photo_url: string
          updated_at: string
          user_id: string
          username: string
          username_key: string | null
          username_updated_at: string
        }
        Insert: {
          bio?: string
          created_at?: string
          firebase_uid?: string | null
          photo_url?: string
          updated_at?: string
          user_id: string
          username: string
          username_key?: string | null
          username_updated_at?: string
        }
        Update: {
          bio?: string
          created_at?: string
          firebase_uid?: string | null
          photo_url?: string
          updated_at?: string
          user_id?: string
          username?: string
          username_key?: string | null
          username_updated_at?: string
        }
        Relationships: []
      }
      promotion_claims: {
        Row: {
          amount: number
          created_at: string
          promotion_id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          promotion_id: string
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          promotion_id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_claims_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "coin_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_claims_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "zy_coin_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string
          firebase_id: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_chat_message_id: string | null
          target_live_id: string | null
          target_profile_id: string | null
          target_type: string
        }
        Insert: {
          created_at?: string
          description?: string
          firebase_id?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_chat_message_id?: string | null
          target_live_id?: string | null
          target_profile_id?: string | null
          target_type: string
        }
        Update: {
          created_at?: string
          description?: string
          firebase_id?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_chat_message_id?: string | null
          target_live_id?: string | null
          target_profile_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_target_chat_message_id_fkey"
            columns: ["target_chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_live_id_fkey"
            columns: ["target_live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          channel_id: string
          cost: number
          created_at: string
          firebase_id: string | null
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          reward_id: string
          status: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          cost: number
          created_at?: string
          firebase_id?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          reward_id: string
          status?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          cost?: number
          created_at?: string
          firebase_id?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          reward_id?: string
          status?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "zy_coin_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          channel_id: string
          cost: number
          created_at: string
          description: string
          firebase_id: string | null
          id: string
          stock: number | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel_id: string
          cost: number
          created_at?: string
          description?: string
          firebase_id?: string | null
          id?: string
          stock?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel_id?: string
          cost?: number
          created_at?: string
          description?: string
          firebase_id?: string | null
          id?: string
          stock?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      support_alerts: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          from_user_id: string
          live_id: string
          message: string | null
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at: string
          from_user_id: string
          live_id: string
          message?: string | null
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          from_user_id?: string
          live_id?: string
          message?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_alerts_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "zy_coin_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_accounts: {
        Row: {
          created_at: string
          email: string
          firebase_uid: string | null
          last_login_at: string
          migrated_at: string | null
          provider: string
          user_id: string
          zytrix_id: string
        }
        Insert: {
          created_at?: string
          email: string
          firebase_uid?: string | null
          last_login_at?: string
          migrated_at?: string | null
          provider: string
          user_id: string
          zytrix_id: string
        }
        Update: {
          created_at?: string
          email?: string
          firebase_uid?: string | null
          last_login_at?: string
          migrated_at?: string | null
          provider?: string
          user_id?: string
          zytrix_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          allow_reactions: boolean
          compact_alerts: boolean
          hide_mature_content: boolean
          safe_mode: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_reactions?: boolean
          compact_alerts?: boolean
          hide_mature_content?: boolean
          safe_mode?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_reactions?: boolean
          compact_alerts?: boolean
          hide_mature_content?: boolean
          safe_mode?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          created_at: string
          last_active_day: string | null
          last_live_id: string | null
          last_watch_reward_at: string | null
          streak_days: number
          updated_at: string
          user_id: string
          watch_minutes: number
          xp: number
        }
        Insert: {
          created_at?: string
          last_active_day?: string | null
          last_live_id?: string | null
          last_watch_reward_at?: string | null
          streak_days?: number
          updated_at?: string
          user_id: string
          watch_minutes?: number
          xp?: number
        }
        Update: {
          created_at?: string
          last_active_day?: string | null
          last_live_id?: string | null
          last_watch_reward_at?: string | null
          streak_days?: number
          updated_at?: string
          user_id?: string
          watch_minutes?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_last_live_id_fkey"
            columns: ["last_live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          total_received: number
          total_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          first_watched_at: string
          last_watched_at: string
          live_id: string
          user_id: string
          watch_seconds: number
        }
        Insert: {
          first_watched_at?: string
          last_watched_at?: string
          live_id: string
          user_id: string
          watch_seconds?: number
        }
        Update: {
          first_watched_at?: string
          last_watched_at?: string
          live_id?: string
          user_id?: string
          watch_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      zy_coin_orders: {
        Row: {
          coins: number
          created_at: string
          firebase_id: string | null
          id: string
          idempotency_key: string
          mode: string
          package_id: string
          paid_at: string | null
          payment_method: string
          price_cents: number
          provider_reference: string | null
          status: string
          user_id: string
        }
        Insert: {
          coins: number
          created_at?: string
          firebase_id?: string | null
          id?: string
          idempotency_key: string
          mode: string
          package_id: string
          paid_at?: string | null
          payment_method: string
          price_cents: number
          provider_reference?: string | null
          status?: string
          user_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          firebase_id?: string | null
          id?: string
          idempotency_key?: string
          mode?: string
          package_id?: string
          paid_at?: string | null
          payment_method?: string
          price_cents?: number
          provider_reference?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      zy_coin_transactions: {
        Row: {
          amount: number
          created_at: string
          firebase_id: string | null
          from_user_id: string | null
          id: string
          idempotency_key: string
          live_id: string | null
          message: string | null
          metadata: Json
          order_id: string | null
          promotion_id: string | null
          reference: string | null
          reversed_transaction_id: string | null
          reward_id: string | null
          status: string
          to_user_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          firebase_id?: string | null
          from_user_id?: string | null
          id?: string
          idempotency_key: string
          live_id?: string | null
          message?: string | null
          metadata?: Json
          order_id?: string | null
          promotion_id?: string | null
          reference?: string | null
          reversed_transaction_id?: string | null
          reward_id?: string | null
          status?: string
          to_user_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          firebase_id?: string | null
          from_user_id?: string | null
          id?: string
          idempotency_key?: string
          live_id?: string | null
          message?: string | null
          metadata?: Json
          order_id?: string | null
          promotion_id?: string | null
          reference?: string | null
          reversed_transaction_id?: string | null
          reward_id?: string | null
          status?: string
          to_user_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "zy_coin_transactions_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zy_coin_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "zy_coin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zy_coin_transactions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "coin_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zy_coin_transactions_reversed_transaction_id_fkey"
            columns: ["reversed_transaction_id"]
            isOneToOne: false
            referencedRelation: "zy_coin_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zy_coin_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cast_poll_vote: {
        Args: { option_uuid: string; poll_uuid: string }
        Returns: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "poll_votes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_coin_promotion: {
        Args: { promotion_uuid: string; request_key: string }
        Returns: string
      }
      close_report: {
        Args: { report_resolution: string; report_uuid: string }
        Returns: {
          created_at: string
          description: string
          firebase_id: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_chat_message_id: string | null
          target_live_id: string | null
          target_profile_id: string | null
          target_type: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_live: {
        Args: {
          channel_uuid: string
          is_mature?: boolean
          live_category_id: string
          live_description: string
          live_playback_url: string
          live_thumbnail_url: string
          live_title: string
        }
        Returns: {
          category_id: string | null
          channel_id: string
          created_at: string
          deleted_at: string | null
          description: string
          ended_at: string | null
          firebase_id: string | null
          host_target_live_id: string | null
          id: string
          mature_content: boolean
          owner_id: string
          playback_url: string
          raid_target_live_id: string | null
          started_at: string | null
          status: string
          support_alert_duration_ms: number | null
          support_alert_min_coins: number | null
          support_alert_sound: string
          support_alert_theme: string | null
          support_goal_coins: number | null
          support_goal_label: string | null
          thumbnail_url: string
          title: string
          total_views: number
          updated_at: string
          visibility: string
          vod_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lives"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_report: {
        Args: {
          report_description?: string
          report_reason: string
          report_target_type: string
          target_uuid: string
        }
        Returns: {
          created_at: string
          description: string
          firebase_id: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_chat_message_id: string | null
          target_live_id: string | null
          target_profile_id: string | null
          target_type: string
        }
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_viewer_count: { Args: { live_uuid: string }; Returns: number }
      heartbeat_viewer: {
        Args: { live_uuid: string }
        Returns: {
          current_viewers: number
          total_views: number
        }[]
      }
      redeem_reward: {
        Args: { live_uuid: string; request_key: string; reward_uuid: string }
        Returns: string
      }
      remove_chat_message: {
        Args: { message_uuid: string }
        Returns: undefined
      }
      send_chat_message: {
        Args: { live_uuid: string; message_text: string; reply_to?: string }
        Returns: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          firebase_id: string | null
          id: string
          live_id: string
          reply_to_id: string | null
          sender_id: string
          status: string
          text: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_live_reaction: {
        Args: { live_uuid: string; reaction_emoji: string }
        Returns: {
          created_at: string
          emoji: string
          expires_at: string
          firebase_id: string | null
          id: string
          live_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "live_reactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_zy_coin_support: {
        Args: {
          coin_amount: number
          live_uuid: string
          request_key: string
          support_message?: string
        }
        Returns: string
      }
      set_live_ban: {
        Args: {
          ban_expires_at?: string
          ban_kind: string
          ban_reason?: string
          live_uuid: string
          target_user: string
        }
        Returns: {
          banned_by: string
          created_at: string
          expires_at: string | null
          kind: string
          live_id: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "live_bans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_live_status: {
        Args: { live_uuid: string; new_status: string }
        Returns: {
          category_id: string | null
          channel_id: string
          created_at: string
          deleted_at: string | null
          description: string
          ended_at: string | null
          firebase_id: string | null
          host_target_live_id: string | null
          id: string
          mature_content: boolean
          owner_id: string
          playback_url: string
          raid_target_live_id: string | null
          started_at: string | null
          status: string
          support_alert_duration_ms: number | null
          support_alert_min_coins: number | null
          support_alert_sound: string
          support_alert_theme: string | null
          support_goal_coins: number | null
          support_goal_label: string | null
          thumbnail_url: string
          title: string
          total_views: number
          updated_at: string
          visibility: string
          vod_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lives"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: {
          new_bio?: string
          new_photo_url?: string
          new_username?: string
        }
        Returns: {
          bio: string
          created_at: string
          firebase_uid: string | null
          photo_url: string
          updated_at: string
          user_id: string
          username: string
          username_key: string | null
          username_updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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

