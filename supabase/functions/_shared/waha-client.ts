export type WahaSessionStatus =
  | "STARTING"
  | "SCAN_QR_CODE"
  | "WORKING"
  | "FAILED"
  | "STOPPED";

export type WahaSession = {
  name: string;
  status: WahaSessionStatus;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
  engine?: string;
};

type WahaClientOptions = {
  baseUrl?: string;
  apiKey?: string;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Secret obrigatório ausente: ${name}`);
  return value;
}

export function normalizeWahaBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function normalizePhoneForWaha(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function fallbackWahaChatId(phone: string): string {
  const normalized = normalizePhoneForWaha(phone);
  return normalized ? `${normalized}@c.us` : "";
}

export class WahaHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "WahaHttpError";
  }
}

export class WahaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: WahaClientOptions = {}) {
    this.baseUrl = normalizeWahaBaseUrl(
      options.baseUrl ?? requiredEnv("WAHA_API_URL"),
    );
    this.apiKey = options.apiKey ?? requiredEnv("WAHA_API_KEY");
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = 15000,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new WahaHttpError(
        `WAHA respondeu HTTP ${response.status}`,
        response.status,
        text.slice(0, 1000),
      );
    }
    if (!text) return null as T;
    return JSON.parse(text) as T;
  }

  listSessions(): Promise<WahaSession[]> {
    return this.request<WahaSession[]>("/api/sessions");
  }

  getSession(sessionName: string): Promise<WahaSession> {
    return this.request<WahaSession>(
      `/api/sessions/${encodeURIComponent(sessionName)}`,
    );
  }

  async checkNumber(
    sessionName: string,
    phone: string,
  ): Promise<{ exists: boolean; chatId: string }> {
    const normalized = normalizePhoneForWaha(phone);
    if (!normalized) return { exists: false, chatId: "" };

    const params = new URLSearchParams({
      session: sessionName,
      phone: normalized,
    });
    const data = await this.request<{
      numberExists?: boolean;
      exists?: boolean;
      chatId?: string;
    }>(`/api/checkNumberStatus?${params.toString()}`);

    return {
      exists: data?.numberExists === true || data?.exists === true,
      chatId: data?.chatId || fallbackWahaChatId(normalized),
    };
  }

  async sendText(input: {
    session: string;
    chatId: string;
    text: string;
  }): Promise<{ id?: string; key?: { id?: string }; [key: string]: unknown }> {
    return this.request("/api/sendText", {
      method: "POST",
      body: JSON.stringify(input),
    }, 30000);
  }

  async sendImage(input: {
    session: string;
    chatId: string;
    fileUrl: string;
    caption?: string;
  }): Promise<{ id?: string; key?: { id?: string }; [key: string]: unknown }> {
    const { mimetype, filename } = guessWahaImageMeta(input.fileUrl);
    return this.request("/api/sendImage", {
      method: "POST",
      body: JSON.stringify({
        session: input.session,
        chatId: input.chatId,
        caption: input.caption || "",
        file: {
          url: input.fileUrl,
          mimetype,
          filename,
        },
      }),
    }, 45000);
  }
}

export function guessWahaImageMeta(url: string): {
  mimetype: string;
  filename: string;
} {
  const clean = url.split("?")[0] || url;
  const filename = decodeURIComponent(clean.split("/").pop() || "campaign-image.jpg");
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimetype =
    ext === "png" ? "image/png"
    : ext === "webp" ? "image/webp"
    : ext === "gif" ? "image/gif"
    : "image/jpeg";
  return { mimetype, filename };
}

export function classifyWahaError(error: unknown): {
  code: string;
  retryable: boolean;
  message: string;
} {
  if (error instanceof WahaHttpError) {
    const body = error.responseBody.toLowerCase();
    if (error.status === 401 || error.status === 403) {
      return { code: "AUTH", retryable: false, message: "Falha de autenticação WAHA" };
    }
    if (error.status === 404) {
      return { code: "SESSION_NOT_FOUND", retryable: false, message: "Sessão WAHA não encontrada" };
    }
    if (error.status === 429) {
      return { code: "RATE_LIMIT", retryable: true, message: "Limite temporário da WAHA" };
    }
    if (
      error.status >= 500 ||
      body.includes("not connected") ||
      body.includes("session is not ready")
    ) {
      return { code: "WAHA_UNAVAILABLE", retryable: true, message: error.message };
    }
    return { code: `HTTP_${error.status}`, retryable: false, message: error.message };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return { code: "TIMEOUT", retryable: true, message: "Timeout ao chamar a WAHA" };
  }
  return {
    code: "UNKNOWN",
    retryable: true,
    message: error instanceof Error ? error.message : "Erro desconhecido",
  };
}
