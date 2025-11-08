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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          content: string
          created_at: string | null
          direction: string | null
          id: string
          lead_id: string
          organization_id: string | null
          type: string
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          direction?: string | null
          id?: string
          lead_id: string
          organization_id?: string | null
          type: string
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          direction?: string | null
          id?: string
          lead_id?: string
          organization_id?: string | null
          type?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_logs: {
        Row: {
          created_at: string
          email: string
          error: string | null
          id: string
          ip: string | null
          method: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          id?: string
          ip?: string | null
          method?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          ip?: string | null
          method?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      broadcast_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          custom_message: string | null
          failed_count: number | null
          id: string
          instance_id: string
          max_delay_seconds: number
          message_template_id: string | null
          min_delay_seconds: number
          name: string
          organization_id: string | null
          sent_count: number | null
          started_at: string | null
          status: string
          total_contacts: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          custom_message?: string | null
          failed_count?: number | null
          id?: string
          instance_id: string
          max_delay_seconds?: number
          message_template_id?: string | null
          min_delay_seconds?: number
          name: string
          organization_id?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_contacts?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          custom_message?: string | null
          failed_count?: number | null
          id?: string
          instance_id?: string
          max_delay_seconds?: number
          message_template_id?: string | null
          min_delay_seconds?: number
          name?: string
          organization_id?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          total_contacts?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_message_template_id_fkey"
            columns: ["message_template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_queue: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          id: string
          name: string | null
          phone: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          name?: string | null
          phone: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queue: {
        Row: {
          call_count: number | null
          call_notes: string | null
          completed_at: string | null
          completed_by: string | null
          completed_by_user_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          notes: string | null
          organization_id: string | null
          priority: string | null
          scheduled_for: string
          status: string | null
          updated_by: string | null
        }
        Insert: {
          call_count?: number | null
          call_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          organization_id?: string | null
          priority?: string | null
          scheduled_for: string
          status?: string | null
          updated_by?: string | null
        }
        Update: {
          call_count?: number | null
          call_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          organization_id?: string | null
          priority?: string | null
          scheduled_for?: string
          status?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queue_history: {
        Row: {
          action: string
          call_count: number | null
          call_notes: string | null
          completed_at: string | null
          completed_by: string | null
          completed_by_user_id: string | null
          created_at: string
          id: string
          lead_id: string
          lead_name: string
          lead_phone: string
          notes: string | null
          organization_id: string | null
          priority: string | null
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          call_count?: number | null
          call_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          lead_name: string
          lead_phone: string
          notes?: string | null
          organization_id?: string | null
          priority?: string | null
          scheduled_for: string
          status: string
          user_id: string
        }
        Update: {
          action?: string
          call_count?: number | null
          call_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          lead_name?: string
          lead_phone?: string
          notes?: string | null
          organization_id?: string | null
          priority?: string | null
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queue_tags: {
        Row: {
          call_queue_id: string
          created_at: string | null
          id: string
          tag_id: string
        }
        Insert: {
          call_queue_id: string
          created_at?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          call_queue_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_tags_call_queue_id_fkey"
            columns: ["call_queue_id"]
            isOneToOne: false
            referencedRelation: "call_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_config: {
        Row: {
          api_key: string | null
          api_url: string
          created_at: string | null
          id: string
          instance_name: string
          is_connected: boolean | null
          organization_id: string | null
          phone_number: string | null
          qr_code: string | null
          updated_at: string | null
          user_id: string
          webhook_enabled: boolean
        }
        Insert: {
          api_key?: string | null
          api_url: string
          created_at?: string | null
          id?: string
          instance_name: string
          is_connected?: boolean | null
          organization_id?: string | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string | null
          user_id: string
          webhook_enabled?: boolean
        }
        Update: {
          api_key?: string | null
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          is_connected?: boolean | null
          organization_id?: string | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evolution_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_logs: {
        Row: {
          created_at: string
          event: string
          id: string
          instance: string | null
          level: string
          message: string | null
          organization_id: string | null
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          instance?: string | null
          level?: string
          message?: string | null
          organization_id?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          instance?: string | null
          level?: string
          message?: string | null
          organization_id?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      international_contacts: {
        Row: {
          company: string | null
          country_code: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          last_contact: string | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string
          source: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          country_code?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone: string
          source?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          country_code?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string
          source?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "international_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          call_count: number | null
          company: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          last_contact: string | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string
          return_date: string | null
          source: string | null
          source_instance_id: string | null
          stage_id: string | null
          status: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          call_count?: number | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone: string
          return_date?: string | null
          source?: string | null
          source_instance_id?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          call_count?: number | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string
          return_date?: string | null
          source?: string | null
          source_instance_id?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_instance_id_fkey"
            columns: ["source_instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          name: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          instance_id: string
          lead_id: string
          media_type: string | null
          media_url: string | null
          message: string
          organization_id: string
          phone: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id: string
          lead_id: string
          media_type?: string | null
          media_url?: string | null
          message: string
          organization_id: string
          phone: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string
          lead_id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          organization_id?: string
          phone?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string | null
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_lid_contacts: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          last_contact: string | null
          lid: string
          name: string
          notes: string | null
          organization_id: string | null
          profile_pic_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          last_contact?: string | null
          lid: string
          name: string
          notes?: string | null
          organization_id?: string | null
          profile_pic_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          last_contact?: string | null
          lid?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          profile_pic_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_lid_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          contact_name: string | null
          created_at: string | null
          direction: string
          id: string
          media_url: string | null
          message_id: string | null
          message_text: string | null
          message_type: string
          organization_id: string | null
          phone: string
          read_status: boolean | null
          timestamp: string
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string | null
          direction: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string
          organization_id?: string | null
          phone: string
          read_status?: boolean | null
          timestamp?: string
          user_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string
          organization_id?: string | null
          phone?: string
          read_status?: boolean | null
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_user: {
        Args: { _manager_id: string; _target_user_id: string }
        Returns: boolean
      }
      create_organization_with_owner: {
        Args: { org_name: string; owner_user_id?: string }
        Returns: string
      }
      get_all_organizations_with_members: {
        Args: never
        Returns: {
          member_created_at: string
          member_email: string
          member_full_name: string
          member_role: string
          member_roles: Json
          member_user_id: string
          org_created_at: string
          org_id: string
          org_name: string
        }[]
      }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          permission: Database["public"]["Enums"]["app_permission"]
        }[]
      }
      get_user_permissions_for_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: {
          permission: Database["public"]["Enums"]["app_permission"]
        }[]
      }
      has_org_permission: {
        Args: {
          _org_id: string
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role:
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_pubdigital_user: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_permission:
        | "view_leads"
        | "create_leads"
        | "edit_leads"
        | "delete_leads"
        | "view_call_queue"
        | "manage_call_queue"
        | "view_broadcast"
        | "create_broadcast"
        | "view_whatsapp"
        | "send_whatsapp"
        | "view_templates"
        | "manage_templates"
        | "view_pipeline"
        | "manage_pipeline"
        | "view_settings"
        | "manage_settings"
        | "manage_users"
        | "view_reports"
      app_role: "admin" | "user"
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
    Enums: {
      app_permission: [
        "view_leads",
        "create_leads",
        "edit_leads",
        "delete_leads",
        "view_call_queue",
        "manage_call_queue",
        "view_broadcast",
        "create_broadcast",
        "view_whatsapp",
        "send_whatsapp",
        "view_templates",
        "manage_templates",
        "view_pipeline",
        "manage_pipeline",
        "view_settings",
        "manage_settings",
        "manage_users",
        "view_reports",
      ],
      app_role: ["admin", "user"],
    },
  },
} as const
