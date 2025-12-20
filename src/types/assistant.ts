export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  actions?: AssistantActionInfo[];
  isExecutingAction?: boolean;
  actionType?: string;
}

export interface AssistantActionInfo {
  type: string;
  status: "executing" | "success" | "error";
  message?: string;
  data?: any;
}

export interface AssistantConversation {
  id: string;
  organization_id: string;
  user_id: string;
  title: string | null;
  messages: AssistantMessage[];
  created_at: string;
  updated_at: string;
}

export interface AssistantAction {
  id: string;
  conversation_id: string | null;
  organization_id: string;
  user_id: string;
  action_type: string;
  function_name: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  error_message: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface AssistantResponse {
  success: boolean;
  message: string;
  conversation_id: string;
  error?: string;
  actions?: AssistantActionInfo[];
}



