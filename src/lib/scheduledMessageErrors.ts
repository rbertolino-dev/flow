/**
 * Converte `error_message` gravado pelo processador (Evolution/API) em texto legível para o usuário.
 */
export function formatScheduledMessageError(errorMessage: string | null | undefined): string {
  if (!errorMessage) return "Erro desconhecido (sem detalhes registrados).";

  try {
    if (
      errorMessage.includes("Instância não está conectada") ||
      errorMessage.includes("nenhuma instância alternativa")
    ) {
      return "A instância do WhatsApp estava desconectada no horário do envio. Reconecte em Configurações ou use outra instância antes de reenviar.";
    }

    if (errorMessage.includes("Instância não encontrada")) {
      return "A instância usada no agendamento não foi encontrada (pode ter sido removida). Escolha outra instância ao criar um novo agendamento.";
    }

    if (errorMessage.includes("Rate limit") || errorMessage.includes("HTTP 429")) {
      return "Limite de envios da API foi atingido (rate limit). Aguarde alguns minutos e use «Reagendar» ou «Enviar agora» depois.";
    }

    if (errorMessage.includes("Número não existe no WhatsApp")) {
      return errorMessage;
    }

    if (errorMessage.includes("[TEST MODE")) {
      return "Modo de teste: o envio real foi desativado. Desative o modo de teste para enviar de verdade.";
    }

    if (
      errorMessage.includes("Tipo de mídia inválido para anexo") ||
      errorMessage.includes("mediatype is not one of enum values")
    ) {
      return "O tipo de anexo não é aceite pelo WhatsApp (Evolution). Use imagem, documento, vídeo ou áudio, ou envie só texto sem URL de mídia.";
    }

    if (errorMessage.includes('"exists":false') || errorMessage.includes("exists: false")) {
      const numberMatch = errorMessage.match(/"number":\s*"([^"]+)"/);
      const jidMatch = errorMessage.match(/"jid":\s*"([^"]+)"/);
      const number = numberMatch
        ? numberMatch[1]
        : jidMatch
          ? jidMatch[1].split("@")[0]
          : "número desconhecido";

      return `O número ${number} não existe no WhatsApp ou não está cadastrado. Verifique se o número está correto e se o contato tem WhatsApp ativo.`;
    }

    if (errorMessage.includes("Evolution API erro 400") || errorMessage.includes("Bad Request")) {
      return "Erro na API do WhatsApp: requisição inválida. Verifique se a instância está configurada corretamente.";
    }

    if (
      errorMessage.includes("401") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("autenticação")
    ) {
      return "Erro de autenticação: a instância do WhatsApp não está autenticada. Verifique as configurações da instância.";
    }

    if (
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("conexão")
    ) {
      return "Erro de conexão: não foi possível falar com a API do WhatsApp. Verifique se a instância está online.";
    }

    if (errorMessage.length > 200) {
      const jsonMatch = errorMessage.match(/\{[^}]+\}/);
      if (jsonMatch) {
        try {
          const errorData = JSON.parse(jsonMatch[0]) as { message?: string };
          if (errorData.message) {
            return `Erro: ${errorData.message}`;
          }
        } catch {
          // ignore
        }
      }
      return errorMessage.substring(0, 200) + "...";
    }
  } catch {
    // fallthrough
  }

  return errorMessage;
}
