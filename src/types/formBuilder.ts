export type FieldType = 
  | 'text' 
  | 'email' 
  | 'phone' 
  | 'textarea' 
  | 'select' 
  | 'checkbox' 
  | 'radio' 
  | 'number' 
  | 'date' 
  | 'file';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // Para select, radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  order: number;
}

export interface FormStyle {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: string;
  borderRadius: string;
  buttonStyle: 'filled' | 'outlined' | 'text';
  buttonColor: string;
  buttonTextColor: string;
  inputBorderColor: string;
  inputFocusColor: string;
}

export interface FormBuilder {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  fields: FormField[];
  style: FormStyle;
  success_message: string;
  redirect_url?: string;
  stage_id?: string; // Estágio do funil onde os leads serão criados
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  form_id: string;
  data: Record<string, any>;
  metadata?: {
    ip?: string;
    user_agent?: string;
    referrer?: string;
  };
}

