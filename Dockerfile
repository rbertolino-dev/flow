# Dockerfile para aplicação React/Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY . .

# Build da aplicação (Vite precisa das variáveis VITE_* em tempo de build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

# Stage 2: Servir com Nginx
FROM nginx:alpine

# Instalar wget para health checks
RUN apk add --no-cache wget

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do Nginx para React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta
EXPOSE 80

# Nginx já inicia automaticamente
CMD ["nginx", "-g", "daemon off;"]



