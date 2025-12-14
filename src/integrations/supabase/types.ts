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
          organization_id: string
          type: string
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          direction?: string | null
          id?: string
          lead_id: string
          organization_id: string
          type: string
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          direction?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
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
      agent_usage_metrics: {
        Row: {
          agent_id: string
          completion_tokens: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_date: string
          prompt_tokens: number | null
          total_cost: number | null
          total_requests: number | null
          total_tokens: number | null
        }
        Insert: {
          agent_id: string
          completion_tokens?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date: string
          prompt_tokens?: number | null
          total_cost?: number | null
          total_requests?: number | null
          total_tokens?: number | null
        }
        Update: {
          agent_id?: string
          completion_tokens?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string
          prompt_tokens?: number | null
          total_cost?: number | null
          total_requests?: number | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_usage_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          agent_id: string
          change_summary: string | null
          created_at: string | null
          id: string
          snapshot: Json
          version: number
        }
        Insert: {
          agent_id: string
          change_summary?: string | null
          created_at?: string | null
          id?: string
          snapshot: Json
          version: number
        }
        Update: {
          agent_id?: string
          change_summary?: string | null
          created_at?: string | null
          id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          allow_fallback: boolean | null
          created_at: string | null
          created_by: string | null
          debounce_time: number | null
          delay_message: number | null
          description: string | null
          evolution_config_id: string | null
          evolution_instance_id: string | null
          expire: number | null
          few_shot_examples: string | null
          function_url: string | null
          guardrails: string | null
          id: string
          ignore_jids: Json | null
          keep_open: boolean | null
          keyword_finish: string | null
          language: string | null
          listening_from_me: boolean | null
          metadata: Json | null
          model: string | null
          name: string
          openai_assistant_id: string | null
          organization_id: string
          persona: Json | null
          policies: Json | null
          prompt_instructions: string | null
          response_format: string | null
          split_messages: number | null
          status: string | null
          stop_bot_from_me: boolean | null
          temperature: number | null
          test_mode: boolean | null
          trigger_operator: string | null
          trigger_type: string | null
          trigger_value: string | null
          unknown_message: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          allow_fallback?: boolean | null
          created_at?: string | null
          created_by?: string | null
          debounce_time?: number | null
          delay_message?: number | null
          description?: string | null
          evolution_config_id?: string | null
          evolution_instance_id?: string | null
          expire?: number | null
          few_shot_examples?: string | null
          function_url?: string | null
          guardrails?: string | null
          id?: string
          ignore_jids?: Json | null
          keep_open?: boolean | null
          keyword_finish?: string | null
          language?: string | null
          listening_from_me?: boolean | null
          metadata?: Json | null
          model?: string | null
          name: string
          openai_assistant_id?: string | null
          organization_id: string
          persona?: Json | null
          policies?: Json | null
          prompt_instructions?: string | null
          response_format?: string | null
          split_messages?: number | null
          status?: string | null
          stop_bot_from_me?: boolean | null
          temperature?: number | null
          test_mode?: boolean | null
          trigger_operator?: string | null
          trigger_type?: string | null
          trigger_value?: string | null
          unknown_message?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          allow_fallback?: boolean | null
          created_at?: string | null
          created_by?: string | null
          debounce_time?: number | null
          delay_message?: number | null
          description?: string | null
          evolution_config_id?: string | null
          evolution_instance_id?: string | null
          expire?: number | null
          few_shot_examples?: string | null
          function_url?: string | null
          guardrails?: string | null
          id?: string
          ignore_jids?: Json | null
          keep_open?: boolean | null
          keyword_finish?: string | null
          language?: string | null
          listening_from_me?: boolean | null
          metadata?: Json | null
          model?: string | null
          name?: string
          openai_assistant_id?: string | null
          organization_id?: string
          persona?: Json | null
          policies?: Json | null
          prompt_instructions?: string | null
          response_format?: string | null
          split_messages?: number | null
          status?: string | null
          stop_bot_from_me?: boolean | null
          temperature?: number | null
          test_mode?: boolean | null
          trigger_operator?: string | null
          trigger_type?: string | null
          trigger_value?: string | null
          unknown_message?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_evolution_config_id_fkey"
            columns: ["evolution_config_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_configs: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          environment: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          environment: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          environment?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_config: {
        Row: {
          created_at: string
          examples: string | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          max_tokens: number | null
          model: string | null
          organization_id: string | null
          restrictions: string | null
          rules: string | null
          system_prompt: string | null
          temperature: number | null
          tone_of_voice: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          examples?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          max_tokens?: number | null
          model?: string | null
          organization_id?: string | null
          restrictions?: string | null
          rules?: string | null
          system_prompt?: string | null
          temperature?: number | null
          tone_of_voice?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          examples?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          max_tokens?: number | null
          model?: string | null
          organization_id?: string | null
          restrictions?: string | null
          rules?: string | null
          system_prompt?: string | null
          temperature?: number | null
          tone_of_voice?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          organization_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_organization_id_fkey"
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
      automation_flows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          flow_data: Json
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          flow_data?: Json
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          flow_data?: Json
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_campaign_templates: {
        Row: {
          created_at: string
          custom_message: string | null
          description: string | null
          id: string
          instance_id: string | null
          instance_name: string | null
          max_delay_seconds: number
          message_template_id: string | null
          message_variations: Json | null
          min_delay_seconds: number
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_message?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          max_delay_seconds?: number
          message_template_id?: string | null
          message_variations?: Json | null
          min_delay_seconds?: number
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_message?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          max_delay_seconds?: number
          message_template_id?: string | null
          message_variations?: Json | null
          min_delay_seconds?: number
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
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
          instance_id: string | null
          instance_name: string | null
          max_delay_seconds: number
          message_template_id: string | null
          min_delay_seconds: number
          name: string
          organization_id: string
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
          instance_id?: string | null
          instance_name?: string | null
          max_delay_seconds?: number
          message_template_id?: string | null
          min_delay_seconds?: number
          name: string
          organization_id: string
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
          instance_id?: string | null
          instance_name?: string | null
          max_delay_seconds?: number
          message_template_id?: string | null
          min_delay_seconds?: number
          name?: string
          organization_id?: string
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
          instance_id: string | null
          name: string | null
          organization_id: string
          personalized_message: string | null
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
          instance_id?: string | null
          name?: string | null
          organization_id: string
          personalized_message?: string | null
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
          instance_id?: string | null
          name?: string | null
          organization_id?: string
          personalized_message?: string | null
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
          {
            foreignKeyName: "broadcast_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_time_windows: {
        Row: {
          created_at: string
          enabled: boolean
          friday_end: string | null
          friday_start: string | null
          id: string
          monday_end: string | null
          monday_start: string | null
          name: string
          organization_id: string
          saturday_end: string | null
          saturday_start: string | null
          sunday_end: string | null
          sunday_start: string | null
          thursday_end: string | null
          thursday_start: string | null
          tuesday_end: string | null
          tuesday_start: string | null
          updated_at: string
          wednesday_end: string | null
          wednesday_start: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          friday_end?: string | null
          friday_start?: string | null
          id?: string
          monday_end?: string | null
          monday_start?: string | null
          name: string
          organization_id: string
          saturday_end?: string | null
          saturday_start?: string | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          friday_end?: string | null
          friday_start?: string | null
          id?: string
          monday_end?: string | null
          monday_start?: string | null
          name?: string
          organization_id?: string
          saturday_end?: string | null
          saturday_start?: string | null
          sunday_end?: string | null
          sunday_start?: string | null
          thursday_end?: string | null
          thursday_start?: string | null
          tuesday_end?: string | null
          tuesday_start?: string | null
          updated_at?: string
          wednesday_end?: string | null
          wednesday_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_time_windows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bubble_configs: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bubble_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bubble_message_tracking: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          id: string
          message_id: string
          metadata: Json | null
          organization_id: string | null
          phone: string
          read_at: string | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_id: string
          metadata?: Json | null
          organization_id?: string | null
          phone: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_id?: string
          metadata?: Json | null
          organization_id?: string | null
          phone?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bubble_message_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bubble_query_history: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          query_params: Json | null
          query_type: string
          response_data: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          query_params?: Json | null
          query_type: string
          response_data?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          query_params?: Json | null
          query_type?: string
          response_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bubble_query_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          completed_at: string | null
          completion_notes: string | null
          created_at: string | null
          description: string | null
          end_datetime: string
          google_calendar_config_id: string
          google_event_id: string
          html_link: string | null
          id: string
          location: string | null
          organization_id: string
          start_datetime: string
          status: string | null
          summary: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          end_datetime: string
          google_calendar_config_id: string
          google_event_id: string
          html_link?: string | null
          id?: string
          location?: string | null
          organization_id: string
          start_datetime: string
          status?: string | null
          summary: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          description?: string | null
          end_datetime?: string
          google_calendar_config_id?: string
          google_event_id?: string
          html_link?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          start_datetime?: string
          status?: string | null
          summary?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_google_calendar_config_id_fkey"
            columns: ["google_calendar_config_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_message_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          media_type: string | null
          media_url: string | null
          name: string
          organization_id: string
          template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          name: string
          organization_id: string
          template: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          name?: string
          organization_id?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          priority: string | null
          scheduled_for: string
          status: string | null
          updated_at: string
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
          organization_id: string
          priority?: string | null
          scheduled_for: string
          status?: string | null
          updated_at?: string
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
          organization_id?: string
          priority?: string | null
          scheduled_for?: string
          status?: string | null
          updated_at?: string
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
      chatwoot_configs: {
        Row: {
          chatwoot_account_id: number
          chatwoot_api_access_token: string
          chatwoot_base_url: string
          created_at: string | null
          default_inbox_id: number | null
          default_inbox_identifier: string | null
          enabled: boolean | null
          id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          chatwoot_account_id: number
          chatwoot_api_access_token: string
          chatwoot_base_url?: string
          created_at?: string | null
          default_inbox_id?: number | null
          default_inbox_identifier?: string | null
          enabled?: boolean | null
          id?: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          chatwoot_account_id?: number
          chatwoot_api_access_token?: string
          chatwoot_base_url?: string
          created_at?: string | null
          default_inbox_id?: number | null
          default_inbox_identifier?: string | null
          enabled?: boolean | null
          id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatwoot_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_cost_config: {
        Row: {
          cost_per_agent_ai_call: number | null
          cost_per_auth_user: number | null
          cost_per_broadcast_message: number | null
          cost_per_database_read: number | null
          cost_per_database_write: number | null
          cost_per_edge_function_call: number | null
          cost_per_form_submission: number | null
          cost_per_incoming_message: number | null
          cost_per_lead_storage: number | null
          cost_per_realtime_message: number | null
          cost_per_scheduled_message: number | null
          cost_per_storage_gb: number | null
          cost_per_workflow_execution: number | null
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cost_per_agent_ai_call?: number | null
          cost_per_auth_user?: number | null
          cost_per_broadcast_message?: number | null
          cost_per_database_read?: number | null
          cost_per_database_write?: number | null
          cost_per_edge_function_call?: number | null
          cost_per_form_submission?: number | null
          cost_per_incoming_message?: number | null
          cost_per_lead_storage?: number | null
          cost_per_realtime_message?: number | null
          cost_per_scheduled_message?: number | null
          cost_per_storage_gb?: number | null
          cost_per_workflow_execution?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cost_per_agent_ai_call?: number | null
          cost_per_auth_user?: number | null
          cost_per_broadcast_message?: number | null
          cost_per_database_read?: number | null
          cost_per_database_write?: number | null
          cost_per_edge_function_call?: number | null
          cost_per_form_submission?: number | null
          cost_per_incoming_message?: number | null
          cost_per_lead_storage?: number | null
          cost_per_realtime_message?: number | null
          cost_per_scheduled_message?: number | null
          cost_per_storage_gb?: number | null
          cost_per_workflow_execution?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      daily_usage_metrics: {
        Row: {
          cost_per_unit: number
          created_at: string
          date: string
          id: string
          metric_type: string
          metric_value: number
          organization_id: string | null
          total_cost: number
          updated_at: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          date: string
          id?: string
          metric_type: string
          metric_value?: number
          organization_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          date?: string
          id?: string
          metric_type?: string
          metric_value?: number
          organization_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_usage_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          phone_number: string | null
          qr_code: string | null
          sync_method: string | null
          sync_path: string | null
          updated_at: string | null
          user_id: string
          webhook_enabled: boolean
          webhook_secret: string
        }
        Insert: {
          api_key?: string | null
          api_url: string
          created_at?: string | null
          id?: string
          instance_name: string
          is_connected?: boolean | null
          organization_id: string
          phone_number?: string | null
          qr_code?: string | null
          sync_method?: string | null
          sync_path?: string | null
          updated_at?: string | null
          user_id: string
          webhook_enabled?: boolean
          webhook_secret?: string
        }
        Update: {
          api_key?: string | null
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          is_connected?: boolean | null
          organization_id?: string
          phone_number?: string | null
          qr_code?: string | null
          sync_method?: string | null
          sync_path?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_enabled?: boolean
          webhook_secret?: string
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
      evolution_providers: {
        Row: {
          api_key: string
          api_url: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      facebook_configs: {
        Row: {
          account_name: string
          created_at: string | null
          enabled: boolean | null
          id: string
          instagram_access_token: string | null
          instagram_account_id: string | null
          instagram_enabled: boolean | null
          instagram_username: string | null
          last_sync_at: string | null
          messenger_enabled: boolean | null
          organization_id: string
          page_access_token: string
          page_id: string
          page_name: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instagram_access_token?: string | null
          instagram_account_id?: string | null
          instagram_enabled?: boolean | null
          instagram_username?: string | null
          last_sync_at?: string | null
          messenger_enabled?: boolean | null
          organization_id: string
          page_access_token: string
          page_id: string
          page_name?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instagram_access_token?: string | null
          instagram_account_id?: string | null
          instagram_enabled?: boolean | null
          instagram_username?: string | null
          last_sync_at?: string | null
          messenger_enabled?: boolean | null
          organization_id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facebook_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_node_id: string | null
          execution_data: Json | null
          flow_id: string
          id: string
          lead_id: string
          next_execution_at: string | null
          organization_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_node_id?: string | null
          execution_data?: Json | null
          flow_id: string
          id?: string
          lead_id: string
          next_execution_at?: string | null
          organization_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_node_id?: string | null
          execution_data?: Json | null
          flow_id?: string
          id?: string
          lead_id?: string
          next_execution_at?: string | null
          organization_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_step_automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          execution_order: number
          id: string
          is_active: boolean
          step_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          execution_order: number
          id?: string
          is_active?: boolean
          step_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          execution_order?: number
          id?: string
          is_active?: boolean
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_step_automations_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "follow_up_template_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_template_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          step_order: number
          template_id: string
          tip: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          step_order: number
          template_id: string
          tip?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          step_order?: number
          template_id?: string
          tip?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "follow_up_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_builders: {
        Row: {
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          organization_id: string
          redirect_url: string | null
          stage_id: string | null
          style: Json
          success_message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          redirect_url?: string | null
          stage_id?: string | null
          style?: Json
          success_message?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          redirect_url?: string | null
          stage_id?: string | null
          style?: Json
          success_message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_builders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_builders_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_configs: {
        Row: {
          account_name: string
          client_id: string
          client_secret: string
          created_at: string
          id: string
          is_active: boolean
          last_access_at: string | null
          organization_id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          account_name: string
          client_id: string
          client_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_access_at?: string | null
          organization_id: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_access_at?: string | null
          organization_id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_business_configs: {
        Row: {
          account_name: string
          business_account_id: string | null
          client_id: string
          client_secret: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_access_at: string | null
          location_id: string | null
          location_name: string | null
          organization_id: string
          refresh_token: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_name: string
          business_account_id?: string | null
          client_id: string
          client_secret: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_access_at?: string | null
          location_id?: string | null
          location_name?: string | null
          organization_id: string
          refresh_token: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_name?: string
          business_account_id?: string | null
          client_id?: string
          client_secret?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_access_at?: string | null
          location_id?: string | null
          location_name?: string | null
          organization_id?: string
          refresh_token?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_business_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_business_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_business_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_business_posts: {
        Row: {
          call_to_action_type: string | null
          call_to_action_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          error_message: string | null
          google_business_config_id: string
          google_post_id: string | null
          id: string
          media_urls: Json | null
          organization_id: string
          post_type: string
          published_at: string | null
          scheduled_for: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          call_to_action_type?: string | null
          call_to_action_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          google_business_config_id: string
          google_post_id?: string | null
          id?: string
          media_urls?: Json | null
          organization_id: string
          post_type: string
          published_at?: string | null
          scheduled_for: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          call_to_action_type?: string | null
          call_to_action_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          google_business_config_id?: string
          google_post_id?: string | null
          id?: string
          media_urls?: Json | null
          organization_id?: string
          post_type?: string
          published_at?: string | null
          scheduled_for?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_business_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_business_posts_google_business_config_id_fkey"
            columns: ["google_business_config_id"]
            isOneToOne: false
            referencedRelation: "google_business_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_business_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_configs: {
        Row: {
          account_name: string
          calendar_id: string
          client_id: string
          client_secret: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          organization_id: string
          refresh_token: string
          updated_at: string | null
        }
        Insert: {
          account_name: string
          calendar_id: string
          client_id: string
          client_secret: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_id: string
          refresh_token: string
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          calendar_id?: string
          client_id?: string
          client_secret?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_id?: string
          refresh_token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hubspot_configs: {
        Row: {
          access_token: string
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          organization_id: string
          portal_id: string | null
          sync_settings: Json | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          organization_id: string
          portal_id?: string | null
          sync_settings?: Json | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          organization_id?: string
          portal_id?: string | null
          sync_settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubspot_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_disconnection_notifications: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          instance_name: string
          notification_sent_at: string | null
          organization_id: string
          qr_code: string | null
          resolved_at: string | null
          updated_at: string
          whatsapp_notification_sent_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          instance_name: string
          notification_sent_at?: string | null
          organization_id: string
          qr_code?: string | null
          resolved_at?: string | null
          updated_at?: string
          whatsapp_notification_sent_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          instance_name?: string
          notification_sent_at?: string | null
          organization_id?: string
          qr_code?: string | null
          resolved_at?: string | null
          updated_at?: string
          whatsapp_notification_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instance_disconnection_notifications_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_disconnection_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instance_ids: string[]
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instance_ids?: string[]
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instance_ids?: string[]
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_groups_organization_id_fkey"
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
      lead_follow_up_step_completions: {
        Row: {
          completed_at: string
          completed_by: string
          follow_up_id: string
          id: string
          step_id: string
        }
        Insert: {
          completed_at?: string
          completed_by: string
          follow_up_id: string
          id?: string
          step_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string
          follow_up_id?: string
          id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_up_step_completions_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_step_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "follow_up_template_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_ups: {
        Row: {
          completed_at: string | null
          created_by: string
          id: string
          lead_id: string
          started_at: string
          template_id: string
        }
        Insert: {
          completed_at?: string | null
          created_by: string
          id?: string
          lead_id: string
          started_at?: string
          template_id: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string
          id?: string
          lead_id?: string
          started_at?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "follow_up_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_products: {
        Row: {
          created_at: string | null
          discount: number | null
          id: string
          lead_id: string
          notes: string | null
          product_id: string
          quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount?: number | null
          id?: string
          lead_id: string
          notes?: string | null
          product_id: string
          quantity?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount?: number | null
          id?: string
          lead_id?: string
          notes?: string | null
          product_id?: string
          quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_products_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          excluded_from_funnel: boolean | null
          has_unread_messages: boolean | null
          id: string
          last_contact: string | null
          last_message_at: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string
          return_date: string | null
          source: string | null
          source_instance_id: string | null
          source_instance_name: string | null
          stage_id: string | null
          status: string
          unread_message_count: number | null
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
          excluded_from_funnel?: boolean | null
          has_unread_messages?: boolean | null
          id?: string
          last_contact?: string | null
          last_message_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          return_date?: string | null
          source?: string | null
          source_instance_id?: string | null
          source_instance_name?: string | null
          stage_id?: string | null
          status?: string
          unread_message_count?: number | null
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
          excluded_from_funnel?: boolean | null
          has_unread_messages?: boolean | null
          id?: string
          last_contact?: string | null
          last_message_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          return_date?: string | null
          source?: string | null
          source_instance_id?: string | null
          source_instance_name?: string | null
          stage_id?: string | null
          status?: string
          unread_message_count?: number | null
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
      mercado_pago_configs: {
        Row: {
          access_token: string
          created_at: string
          environment: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          environment?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          environment?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercado_pago_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_pago_payments: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          mercado_pago_preference_id: string
          organization_id: string
          payment_link: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          mercado_pago_preference_id: string
          organization_id: string
          payment_link: string
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          mercado_pago_preference_id?: string
          organization_id?: string
          payment_link?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "mercado_pago_payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_pago_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
      n8n_configs: {
        Row: {
          api_key: string
          api_url: string
          connection_status: string
          created_at: string
          id: string
          is_active: boolean
          last_connection_test: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_connection_test?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_connection_test?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      openai_configs: {
        Row: {
          api_key: string
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "openai_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_limits: {
        Row: {
          created_at: string | null
          current_instances_count: number | null
          current_leads_count: number | null
          current_month_broadcasts: number | null
          current_month_scheduled: number | null
          current_storage_used_gb: number | null
          current_users_count: number | null
          disabled_features: Json | null
          enabled_features: Json | null
          evolution_provider_id: string | null
          features_override_mode: string | null
          id: string
          last_reset_at: string | null
          max_broadcasts_per_month: number | null
          max_instances: number | null
          max_leads: number | null
          max_scheduled_messages_per_month: number | null
          max_storage_gb: number | null
          max_users: number | null
          organization_id: string
          plan_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_instances_count?: number | null
          current_leads_count?: number | null
          current_month_broadcasts?: number | null
          current_month_scheduled?: number | null
          current_storage_used_gb?: number | null
          current_users_count?: number | null
          disabled_features?: Json | null
          enabled_features?: Json | null
          evolution_provider_id?: string | null
          features_override_mode?: string | null
          id?: string
          last_reset_at?: string | null
          max_broadcasts_per_month?: number | null
          max_instances?: number | null
          max_leads?: number | null
          max_scheduled_messages_per_month?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          organization_id: string
          plan_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_instances_count?: number | null
          current_leads_count?: number | null
          current_month_broadcasts?: number | null
          current_month_scheduled?: number | null
          current_storage_used_gb?: number | null
          current_users_count?: number | null
          disabled_features?: Json | null
          enabled_features?: Json | null
          evolution_provider_id?: string | null
          features_override_mode?: string | null
          id?: string
          last_reset_at?: string | null
          max_broadcasts_per_month?: number | null
          max_instances?: number | null
          max_leads?: number | null
          max_scheduled_messages_per_month?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          organization_id?: string
          plan_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_limits_evolution_provider_id_fkey"
            columns: ["evolution_provider_id"]
            isOneToOne: false
            referencedRelation: "evolution_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
      organization_onboarding_progress: {
        Row: {
          completed_at: string
          id: string
          organization_id: string
          step_completed: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          organization_id: string
          step_completed: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          organization_id?: string
          step_completed?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_type: string | null
          city: string | null
          company_profile: string | null
          created_at: string
          expectations: string | null
          id: string
          name: string
          onboarding_completed: boolean | null
          state: string | null
          tax_regime: string | null
          updated_at: string
        }
        Insert: {
          business_type?: string | null
          city?: string | null
          company_profile?: string | null
          created_at?: string
          expectations?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean | null
          state?: string | null
          tax_regime?: string | null
          updated_at?: string
        }
        Update: {
          business_type?: string | null
          city?: string | null
          company_profile?: string | null
          created_at?: string
          expectations?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean | null
          state?: string | null
          tax_regime?: string | null
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
          organization_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
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
      plans: {
        Row: {
          billing_period: string | null
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_broadcasts_per_month: number | null
          max_instances: number | null
          max_leads: number | null
          max_scheduled_messages_per_month: number | null
          max_storage_gb: number | null
          max_users: number | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_broadcasts_per_month?: number | null
          max_instances?: number | null
          max_leads?: number | null
          max_scheduled_messages_per_month?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name: string
          price?: number
          updated_at?: string | null
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_broadcasts_per_month?: number | null
          max_instances?: number | null
          max_leads?: number | null
          max_scheduled_messages_per_month?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      post_sale_activities: {
        Row: {
          content: string
          created_at: string
          direction: string | null
          id: string
          organization_id: string
          post_sale_lead_id: string
          type: string
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string
          direction?: string | null
          id?: string
          organization_id: string
          post_sale_lead_id: string
          type: string
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          direction?: string | null
          id?: string
          organization_id?: string
          post_sale_lead_id?: string
          type?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_activities_post_sale_lead_id_fkey"
            columns: ["post_sale_lead_id"]
            isOneToOne: false
            referencedRelation: "post_sale_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_lead_tags: {
        Row: {
          created_at: string
          id: string
          post_sale_lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_sale_lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_sale_lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_lead_tags_post_sale_lead_id_fkey"
            columns: ["post_sale_lead_id"]
            isOneToOne: false
            referencedRelation: "post_sale_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          last_contact: string | null
          name: string
          notes: string | null
          organization_id: string
          original_lead_id: string | null
          phone: string
          source: string
          stage_id: string | null
          status: string
          transferred_at: string | null
          transferred_by: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name: string
          notes?: string | null
          organization_id: string
          original_lead_id?: string | null
          phone: string
          source?: string
          stage_id?: string | null
          status?: string
          transferred_at?: string | null
          transferred_by?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          original_lead_id?: string | null
          phone?: string
          source?: string
          stage_id?: string | null
          status?: string
          transferred_at?: string | null
          transferred_by?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_leads_original_lead_id_fkey"
            columns: ["original_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "post_sale_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          commission_fixed: number | null
          commission_percentage: number | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          min_stock: number | null
          name: string
          organization_id: string
          price: number
          sku: string | null
          stock_quantity: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          commission_fixed?: number | null
          commission_percentage?: number | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_stock?: number | null
          name: string
          organization_id: string
          price?: number
          sku?: string | null
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          commission_fixed?: number | null
          commission_percentage?: number | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_stock?: number | null
          name?: string
          organization_id?: string
          price?: number
          sku?: string | null
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
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
          approval_status: string | null
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
          workflow_id: string | null
        }
        Insert: {
          approval_status?: string | null
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
          workflow_id?: string | null
        }
        Update: {
          approval_status?: string | null
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
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_commissions: {
        Row: {
          commission_rate: number
          commission_value: number
          created_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          sale_value: number
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          commission_rate: number
          commission_value: number
          created_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          sale_value: number
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          commission_rate?: number
          commission_value?: number
          created_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          sale_value?: number
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_commissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_commissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_goals: {
        Row: {
          created_at: string | null
          current_value: number | null
          goal_type: string
          id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          status: string | null
          target_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          goal_type?: string
          id?: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          status?: string | null
          target_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          goal_type?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string | null
          target_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          organization_id: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
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
      user_organizations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
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
      whatsapp_boletos: {
        Row: {
          asaas_customer_id: string
          asaas_payment_id: string
          boleto_pdf_url: string | null
          boleto_url: string | null
          codigo_barras: string | null
          created_at: string
          criado_por: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          id: string
          lead_id: string
          linha_digitavel: string | null
          nosso_numero: string | null
          organization_id: string
          referencia_externa: string | null
          scheduled_message_id: string | null
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
          workflow_id: string | null
        }
        Insert: {
          asaas_customer_id: string
          asaas_payment_id: string
          boleto_pdf_url?: string | null
          boleto_url?: string | null
          codigo_barras?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          id?: string
          lead_id: string
          linha_digitavel?: string | null
          nosso_numero?: string | null
          organization_id: string
          referencia_externa?: string | null
          scheduled_message_id?: string | null
          status?: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
          workflow_id?: string | null
        }
        Update: {
          asaas_customer_id?: string
          asaas_payment_id?: string
          boleto_pdf_url?: string | null
          boleto_url?: string | null
          codigo_barras?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          id?: string
          lead_id?: string
          linha_digitavel?: string | null
          nosso_numero?: string | null
          organization_id?: string
          referencia_externa?: string | null
          scheduled_message_id?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_boletos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boletos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boletos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boletos_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boletos_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
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
      whatsapp_status_posts: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          instance_id: string
          media_type: string
          media_url: string
          organization_id: string
          published_at: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          instance_id: string
          media_type: string
          media_url: string
          organization_id: string
          published_at?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string
          media_type?: string
          media_url?: string
          organization_id?: string
          published_at?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_status_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_status_posts_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_status_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflow_approvals: {
        Row: {
          approval_date: string | null
          approved_at: string | null
          approved_by: string | null
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          lead_id: string
          message_body: string
          organization_id: string
          rejection_reason: string | null
          scheduled_message_id: string | null
          status: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          approval_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          lead_id: string
          message_body: string
          organization_id: string
          rejection_reason?: string | null
          scheduled_message_id?: string | null
          status?: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          approval_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          lead_id?: string
          message_body?: string
          organization_id?: string
          rejection_reason?: string | null
          scheduled_message_id?: string | null
          status?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflow_approvals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_approvals_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_approvals_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflow_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          organization_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          organization_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          organization_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflow_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_attachments_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflow_contact_attachments: {
        Row: {
          contact_phone: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          lead_id: string
          metadata: Json | null
          month_reference: string | null
          organization_id: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          contact_phone: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          lead_id: string
          metadata?: Json | null
          month_reference?: string | null
          organization_id: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          contact_phone?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          month_reference?: string | null
          organization_id?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflow_contact_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_contact_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_contact_attachments_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflow_groups: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          group_name: string
          id: string
          instance_id: string
          organization_id: string
          participant_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          group_name: string
          id?: string
          instance_id: string
          organization_id: string
          participant_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          group_name?: string
          id?: string
          instance_id?: string
          organization_id?: string
          participant_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflow_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflow_lists: {
        Row: {
          contacts: Json
          created_at: string
          default_instance_id: string | null
          description: string | null
          id: string
          list_type: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          contacts?: Json
          created_at?: string
          default_instance_id?: string | null
          description?: string | null
          id?: string
          list_type?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          contacts?: Json
          created_at?: string
          default_instance_id?: string | null
          description?: string | null
          id?: string
          list_type?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflow_lists_default_instance_id_fkey"
            columns: ["default_instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflow_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflows: {
        Row: {
          approval_deadline_hours: number | null
          created_at: string
          created_by: string | null
          custom_interval_unit: string | null
          custom_interval_value: number | null
          day_of_month: number | null
          days_of_week: string[] | null
          default_instance_id: string | null
          end_date: string | null
          group_id: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          message_body: string | null
          message_template_id: string | null
          name: string
          next_run_at: string | null
          observations: string | null
          organization_id: string
          periodicity: string
          recipient_mode: string
          recipient_type: string | null
          requires_approval: boolean | null
          send_time: string
          start_date: string
          status: string
          template_mode: string
          timezone: string
          trigger_offset_days: number
          trigger_type: string
          updated_at: string
          workflow_list_id: string
          workflow_type: string
        }
        Insert: {
          approval_deadline_hours?: number | null
          created_at?: string
          created_by?: string | null
          custom_interval_unit?: string | null
          custom_interval_value?: number | null
          day_of_month?: number | null
          days_of_week?: string[] | null
          default_instance_id?: string | null
          end_date?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          message_body?: string | null
          message_template_id?: string | null
          name: string
          next_run_at?: string | null
          observations?: string | null
          organization_id: string
          periodicity: string
          recipient_mode?: string
          recipient_type?: string | null
          requires_approval?: boolean | null
          send_time: string
          start_date: string
          status?: string
          template_mode?: string
          timezone?: string
          trigger_offset_days?: number
          trigger_type?: string
          updated_at?: string
          workflow_list_id: string
          workflow_type?: string
        }
        Update: {
          approval_deadline_hours?: number | null
          created_at?: string
          created_by?: string | null
          custom_interval_unit?: string | null
          custom_interval_value?: number | null
          day_of_month?: number | null
          days_of_week?: string[] | null
          default_instance_id?: string | null
          end_date?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          message_body?: string | null
          message_template_id?: string | null
          name?: string
          next_run_at?: string | null
          observations?: string | null
          organization_id?: string
          periodicity?: string
          recipient_mode?: string
          recipient_type?: string | null
          requires_approval?: boolean | null
          send_time?: string
          start_date?: string
          status?: string
          template_mode?: string
          timezone?: string
          trigger_offset_days?: number
          trigger_type?: string
          updated_at?: string
          workflow_list_id?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflows_default_instance_id_fkey"
            columns: ["default_instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflows_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflow_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflows_message_template_id_fkey"
            columns: ["message_template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_workflows_workflow_list_id_fkey"
            columns: ["workflow_list_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_workflow_lists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_to_call_queue_secure: {
        Args: {
          p_lead_id: string
          p_notes: string
          p_priority: string
          p_scheduled_for: string
        }
        Returns: string
      }
      can_create_evolution_instance: {
        Args: { _org_id: string }
        Returns: boolean
      }
      can_manage_user: {
        Args: { _manager_id: string; _target_user_id: string }
        Returns: boolean
      }
      can_schedule_message_for_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
      create_default_post_sale_stages: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: undefined
      }
      create_lead_secure: {
        Args: {
          p_company?: string
          p_email?: string
          p_name: string
          p_notes?: string
          p_org_id: string
          p_phone: string
          p_source?: string
          p_stage_id?: string
          p_value?: number
        }
        Returns: string
      }
      create_organization_with_owner: {
        Args: { org_name: string; owner_user_id?: string }
        Returns: string
      }
      delete_user_from_organization: {
        Args: { _org_id: string; _user_id: string }
        Returns: undefined
      }
      ensure_org_has_pipeline_stages: {
        Args: { _org_id: string }
        Returns: undefined
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
      get_daily_metrics: {
        Args: { end_date: string; start_date: string }
        Returns: {
          broadcast_count: number
          date: string
          incoming_count: number
          leads_count: number
          scheduled_count: number
        }[]
      }
      get_instance_risk_score: {
        Args: { p_hours_back?: number; p_instance_id: string }
        Returns: {
          connection_state_changes_total: number
          consecutive_failures_max: number
          error_rate: number
          instance_id: string
          last_connection_state: string
          last_error_message: string
          messages_failed_total: number
          messages_sent_total: number
          period_end: string
          period_start: string
          rate_limits_detected: number
          risk_score: number
        }[]
      }
      get_organization_evolution_provider: {
        Args: { _org_id: string }
        Returns: {
          api_key: string
          api_url: string
          provider_id: string
          provider_name: string
        }[]
      }
      get_organization_metrics: {
        Args: {
          current_month_end: string
          current_month_start: string
          previous_month_end: string
          previous_month_start: string
        }
        Returns: {
          current_broadcast: number
          current_incoming: number
          current_leads: number
          current_scheduled: number
          org_id: string
          org_name: string
          prev_broadcast: number
          prev_incoming: number
          prev_leads: number
          prev_scheduled: number
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
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      increment_unread_count: {
        Args: { lead_id_param: string }
        Returns: undefined
      }
      initialize_organization_trial: {
        Args: { _organization_id: string }
        Returns: undefined
      }
      is_pubdigital_user: { Args: { _user_id: string }; Returns: boolean }
      organization_has_evolution_provider: {
        Args: { _org_id: string }
        Returns: boolean
      }
      organization_has_feature: {
        Args: { _feature: string; _organization_id: string }
        Returns: boolean
      }
      transfer_user_data_to_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: undefined
      }
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
