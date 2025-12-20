import { FormField, FormStyle } from "./formBuilder";

export type SurveyType = 'standard' | 'quick';

export interface Survey {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  type: SurveyType;
  fields: FormField[];
  style: FormStyle;
  success_message: string;
  redirect_url?: string;
  is_active: boolean;
  allow_multiple_responses: boolean;
  collect_respondent_info: boolean;
  expires_at?: string;
  is_closed: boolean;
  public_slug?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  organization_id: string;
  respondent_name?: string;
  respondent_email?: string;
  responses: Record<string, any>;
  metadata?: {
    ip?: string;
    user_agent?: string;
    referrer?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface SurveyReport {
  survey: Survey;
  totalResponses: number;
  completionRate?: number;
  averageTime?: number;
  responsesByField: Record<string, FieldResponseStats>;
  responsesOverTime: Array<{ date: string; count: number }>;
}

export interface FieldResponseStats {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  totalResponses: number;
  distribution?: Record<string, number>; // Para select/radio: { "Opção A": 10, "Opção B": 5 }
  average?: number; // Para number
  min?: number;
  max?: number;
  textResponses?: string[]; // Para text/textarea (primeiras 100)
}

export interface QuickSurveyTemplate {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  icon: string;
}

