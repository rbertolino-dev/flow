import { N8nWorkflow } from "@/hooks/useN8nConfig";

// Função auxiliar para gerar UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Função auxiliar para criar node
function createNode(
  name: string,
  type: string,
  position: [number, number],
  parameters: any = {},
  typeVersion: number = 1
) {
  return {
    id: generateUUID(),
    name,
    type,
    typeVersion,
    position,
    parameters,
  };
}

export interface N8nTemplate {
  id: string;
  name: string;
  description: string;
  category: "Integração" | "Automação" | "Notificação" | "Processamento";
  icon: string;
  workflow: Partial<N8nWorkflow>;
  tags: string[];
}

// Função para criar template com conexões corretas
function createTemplateWorkflow(name: string, nodes: any[], connections: Record<string, any>): Partial<N8nWorkflow> {
  return {
    name,
    nodes,
    connections,
    settings: {
      executionOrder: "v1",
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "all",
      saveManualExecutions: true,
    },
    staticData: null,
    tags: [],
  };
}

export const N8N_TEMPLATES: N8nTemplate[] = [
  {
    id: "webhook-db-email",
    name: "Webhook → Database → Email",
    description: "Recebe dados via webhook, salva no banco de dados e envia email de confirmação",
    category: "Integração",
    icon: "🌐",
    tags: ["webhook", "database", "email"],
    workflow: (() => {
      const node1 = createNode("Webhook", "n8n-nodes-base.webhook", [250, 300], {
        httpMethod: "POST",
        path: "webhook-data",
        responseMode: "responseNode",
      }, 1.1);
      const node2 = createNode("PostgreSQL", "n8n-nodes-base.postgres", [550, 300], {
        operation: "insert",
        schema: "public",
        table: "webhook_data",
        columns: "id, data, created_at",
        additionalFields: {},
      }, 2.4);
      const node3 = createNode("Send Email", "n8n-nodes-base.emailSend", [850, 300], {
        fromEmail: "noreply@example.com",
        toEmail: "admin@example.com",
        subject: "Dados recebidos via webhook",
        text: "Os dados foram salvos com sucesso no banco de dados.",
        options: {},
      }, 2.1);
      return createTemplateWorkflow(
        "Webhook to Database to Email",
        [node1, node2, node3],
        {
          [node1.id]: {
            main: [[{ node: node2.id, type: "main", index: 0 }]],
          },
          [node2.id]: {
            main: [[{ node: node3.id, type: "main", index: 0 }]],
          },
        }
      );
    })(),
  },
  {
    id: "schedule-api-slack",
    name: "Schedule → API → Slack",
    description: "Executa periodicamente, busca dados de uma API e envia notificação no Slack",
    category: "Automação",
    icon: "⏰",
    tags: ["schedule", "api", "slack"],
    workflow: (() => {
      const node1 = createNode("Schedule Trigger", "n8n-nodes-base.scheduleTrigger", [250, 300], {
        rule: {
          interval: [{ field: "hours", hoursInterval: 1 }],
        },
      }, 1.2);
      const node2 = createNode("HTTP Request", "n8n-nodes-base.httpRequest", [550, 300], {
        method: "GET",
        url: "https://api.exemplo.com/data",
        authentication: "none",
        options: {},
      }, 4.1);
      const node3 = createNode("Slack", "n8n-nodes-base.slack", [850, 300], {
        resource: "message",
        operation: "postMessage",
        channel: "#notifications",
        text: "Dados atualizados: {{ $json.data }}",
        otherOptions: {},
      }, 2.1);
      return createTemplateWorkflow(
        "Scheduled API to Slack",
        [node1, node2, node3],
        {
          [node1.id]: {
            main: [[{ node: node2.id, type: "main", index: 0 }]],
          },
          [node2.id]: {
            main: [[{ node: node3.id, type: "main", index: 0 }]],
          },
        }
      );
    })(),
  },
  {
    id: "manual-process-webhook",
    name: "Manual → Process → Webhook",
    description: "Trigger manual que processa dados e envia para webhook externo",
    category: "Processamento",
    icon: "🔄",
    tags: ["manual", "process", "webhook"],
    workflow: (() => {
      const node1 = createNode("Manual Trigger", "n8n-nodes-base.manualTrigger", [250, 300], {}, 1);
      const node2 = createNode("Set", "n8n-nodes-base.set", [550, 300], {
        values: {
          string: [
            {
              name: "processed",
              value: "true",
            },
            {
              name: "timestamp",
              value: "={{ $now }}",
            },
          ],
        },
        options: {},
      }, 3.3);
      const node3 = createNode("HTTP Request", "n8n-nodes-base.httpRequest", [850, 300], {
        method: "POST",
        url: "https://api.exemplo.com/webhook",
        authentication: "none",
        bodyParameters: {
          parameters: [
            {
              name: "data",
              value: "={{ $json }}",
            },
          ],
        },
        options: {},
      }, 4.1);
      return createTemplateWorkflow(
        "Manual Process to Webhook",
        [node1, node2, node3],
        {
          [node1.id]: {
            main: [[{ node: node2.id, type: "main", index: 0 }]],
          },
          [node2.id]: {
            main: [[{ node: node3.id, type: "main", index: 0 }]],
          },
        }
      );
    })(),
  },
  {
    id: "webhook-if-email",
    name: "Webhook → If → Email",
    description: "Recebe webhook, valida condição e envia email apenas se necessário",
    category: "Notificação",
    icon: "📧",
    tags: ["webhook", "condition", "email"],
    workflow: (() => {
      const node1 = createNode("Webhook", "n8n-nodes-base.webhook", [250, 300], {
        httpMethod: "POST",
        path: "conditional",
        responseMode: "responseNode",
      }, 1.1);
      const node2 = createNode("IF", "n8n-nodes-base.if", [550, 300], {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
          },
          conditions: [
            {
              id: generateUUID(),
              leftValue: "={{ $json.priority }}",
              rightValue: "high",
              operator: {
                type: "string",
                operation: "equals",
              },
            },
          ],
          combinator: "and",
        },
        options: {},
      }, 2);
      const node3 = createNode("Send Email", "n8n-nodes-base.emailSend", [750, 200], {
        fromEmail: "noreply@example.com",
        toEmail: "admin@example.com",
        subject: "Alerta de Prioridade Alta",
        text: "Recebido um evento de prioridade alta: {{ $json }}",
        options: {},
      }, 2.1);
      const node4 = createNode("Respond to Webhook", "n8n-nodes-base.respondToWebhook", [750, 400], {
        options: {
          responseCode: 200,
          responseBody: "Processed",
        },
      }, 1.1);
      return createTemplateWorkflow(
        "Webhook Conditional Email",
        [node1, node2, node3, node4],
        {
          [node1.id]: {
            main: [[{ node: node2.id, type: "main", index: 0 }]],
          },
          [node2.id]: {
            main: [
              [{ node: node3.id, type: "main", index: 0 }], // true
              [{ node: node4.id, type: "main", index: 0 }], // false
            ],
          },
        }
      );
    })(),
  },
  {
    id: "cron-db-telegram",
    name: "Cron → Database → Telegram",
    description: "Executa diariamente, consulta banco e envia relatório no Telegram",
    category: "Automação",
    icon: "📱",
    tags: ["cron", "database", "telegram"],
    workflow: (() => {
      const node1 = createNode("Cron", "n8n-nodes-base.cron", [250, 300], {
        triggerTimes: {
          item: [
            {
              mode: "everyDay",
              hour: 9,
              minute: 0,
            },
          ],
        },
      }, 1.1);
      const node2 = createNode("PostgreSQL", "n8n-nodes-base.postgres", [550, 300], {
        operation: "executeQuery",
        query: "SELECT COUNT(*) as total FROM leads WHERE created_at >= CURRENT_DATE",
        options: {},
      }, 2.4);
      const node3 = createNode("Telegram", "n8n-nodes-base.telegram", [850, 300], {
        resource: "message",
        operation: "sendMessage",
        chatId: "YOUR_CHAT_ID",
        text: "📊 Relatório Diário:\n\nTotal de leads hoje: {{ $json.total }}",
        additionalFields: {},
      }, 1.2);
      return createTemplateWorkflow(
        "Daily Database Report to Telegram",
        [node1, node2, node3],
        {
          [node1.id]: {
            main: [[{ node: node2.id, type: "main", index: 0 }]],
          },
          [node2.id]: {
            main: [[{ node: node3.id, type: "main", index: 0 }]],
          },
        }
      );
    })(),
  },
  {
    id: "webhook-transform-api",
    name: "Webhook → Transform → API",
    description: "Recebe webhook, transforma dados e envia para API externa",
    category: "Processamento",
    icon: "⚙️",
    tags: ["webhook", "transform", "api"],
    workflow: (() => {
      const node1 = createNode("Webhook", "n8n-nodes-base.webhook", [250, 300], {
        httpMethod: "POST",
        path: "transform",
        responseMode: "responseNode",
      }, 1.1);
      const node2 = createNode("Code", "n8n-nodes-base.code", [550, 300], {
        mode: "runOnceForAllItems",
        jsCode: "// Transformar dados\nconst items = $input.all();\nreturn items.map(item => ({\n  json: {\n    ...item.json,\n    processed: true,\n    timestamp: new Date().toISOString(),\n  }\n}));",
      }, 2.4);
      const node3 = createNode("HTTP Request", "n8n-nodes-base.httpRequest", [850, 300], {
        method: "POST",
        url: "https://api.exemplo.com/process",
        authentication: "none",
        bodyParameters: {
          parameters: [
            {
              name: "data",
              value: "={{ $json }}",
            },
          ],
        },
        options: {},
      }, 4.1);
      return createTemplateWorkflow(
        "Webhook Transform to API",
        [node1, node2, node3],
        {
          [node1.id]: {
            main: [[{ node: node2.id, type: "main", index: 0 }]],
          },
          [node2.id]: {
            main: [[{ node: node3.id, type: "main", index: 0 }]],
          },
        }
      );
    })(),
  },
];

// Função para corrigir conexões usando IDs dos nodes (mantida para compatibilidade)
export function fixTemplateConnections(template: Partial<N8nWorkflow>): Partial<N8nWorkflow> {
  // Os templates já usam IDs corretos, então apenas retornar
  return template;
}
