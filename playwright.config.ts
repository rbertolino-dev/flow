import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para testes E2E
 * 
 * Esta configuração otimiza:
 * - Timeouts e retries para maior confiabilidade
 * - Captura de screenshots e vídeos em falhas
 * - Relatórios detalhados
 * - Execução paralela otimizada
 */
export default defineConfig({
  // Diretório de testes
  testDir: './tests/e2e',
  
  // Timeout padrão para cada teste
  timeout: 30 * 1000, // 30 segundos
  
  // Timeout para expect (assertions)
  expect: {
    timeout: 10 * 1000, // 10 segundos
    // Comparação visual (visual regression testing)
    toHaveScreenshot: {
      threshold: 0.2, // 20% de diferença permitida
      mode: 'only-changed', // Só compara se mudou
    },
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },
  
  // Número de retries em caso de falha
  retries: process.env.CI ? 2 : 1,
  
  // Número de workers (paralelização)
  workers: process.env.CI ? 2 : 4,
  
  // Relatórios
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  
  // Configurações compartilhadas
  use: {
    // Base URL da aplicação
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    
    // Timeout para ações (click, fill, etc)
    actionTimeout: 15 * 1000, // 15 segundos
    
    // Timeout para navegação
    navigationTimeout: 30 * 1000, // 30 segundos
    
    // Capturar screenshot em falhas
    screenshot: 'only-on-failure',
    
    // Capturar vídeo em falhas
    video: 'retain-on-failure',
    
    // Trace para debug
    trace: 'retain-on-failure',
    
    // Headless mode (sempre ativo por padrão para permitir execução em servidores sem X11)
    headless: process.env.PLAYWRIGHT_HEADLESS === 'false' ? false : true,
    
    // Viewport padrão
    viewport: { width: 1280, height: 720 },
    
    // Ignorar HTTPS errors (útil para desenvolvimento)
    ignoreHTTPSErrors: true,
  },
  
  // Configurações por projeto (navegadores)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Servidor web para desenvolvimento
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutos para iniciar
    stdout: 'ignore',
    stderr: 'pipe',
  },
  
  // Configurações globais
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // Output directory
  outputDir: 'test-results/artifacts',
});



