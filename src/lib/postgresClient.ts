// Cliente PostgreSQL para conexão com o banco de serviços
// Nota: Este arquivo é apenas para referência de tipos
// A conexão real será feita via Edge Function no servidor

// Variáveis de ambiente necessárias:
// POSTGRES_HOST=localhost
// POSTGRES_PORT=5432
// POSTGRES_DB=budget_services
// POSTGRES_USER=budget_user
// POSTGRES_PASSWORD=<senha>

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function getPostgresConnectionString(config: PostgresConfig): string {
  return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
}

// Nota: A conexão real será feita na Edge Function usando Deno
// Este arquivo serve apenas como documentação da estrutura


