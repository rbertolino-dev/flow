import { ReactNode } from "react";
import { useIntegrationAccess } from "@/hooks/useIntegrationAccess";

interface ConditionalIntegrationProps {
  /**
   * ID da integração (ex: 'google-calendar', 'gmail', etc.)
   * Deve corresponder a uma chave em INTEGRATION_FEATURES
   */
  integrationId: string;
  
  /**
   * Conteúdo a ser renderizado se a integração estiver habilitada
   */
  children: ReactNode;
  
  /**
   * Componente alternativo a ser renderizado se a integração não estiver habilitada
   * Se não fornecido, nada será renderizado
   */
  fallback?: ReactNode;
}

/**
 * Componente wrapper que renderiza o conteúdo apenas se a integração
 * estiver habilitada no plano da organização atual.
 * 
 * @example
 * ```tsx
 * <ConditionalIntegration integrationId="google-calendar">
 *   <GoogleCalendarIntegrationPanel />
 * </ConditionalIntegration>
 * ```
 */
export function ConditionalIntegration({
  integrationId,
  children,
  fallback = null,
}: ConditionalIntegrationProps) {
  const hasAccess = useIntegrationAccess(integrationId);
  
  if (!hasAccess) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

