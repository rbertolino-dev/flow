import { Page } from '@playwright/test';

/**
 * ⚡ Helpers para testes de performance
 * 
 * Mede métricas de performance como um usuário real
 */

export interface PerformanceMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
}

/**
 * Mede métricas de performance da página
 */
export async function measurePerformance(
  page: Page,
  testName: string
): Promise<PerformanceMetrics> {
  // Aguardar carregamento completo
  await page.waitForLoadState('networkidle');
  
  // Executar medição no contexto da página
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    const firstPaint = paint.find(p => p.name === 'first-paint')?.startTime || 0;
    const firstContentfulPaint = paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0;
    
    // Calcular métricas
    const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
    const loadComplete = navigation.loadEventEnd - navigation.loadEventStart;
    
    // Web Vitals (se disponíveis)
    const vitals = (window as any).webVitals || {};
    
    return {
      domContentLoaded,
      loadComplete,
      firstPaint,
      firstContentfulPaint,
      timeToInteractive: vitals.TTI || 0,
      totalBlockingTime: vitals.TBT || 0,
      largestContentfulPaint: vitals.LCP || 0,
      cumulativeLayoutShift: vitals.CLS || 0,
    };
  });
  
  // Log das métricas
  console.log(`📊 Performance Metrics - ${testName}:`, {
    'DOM Content Loaded': `${metrics.domContentLoaded.toFixed(2)}ms`,
    'Load Complete': `${metrics.loadComplete.toFixed(2)}ms`,
    'First Paint': `${metrics.firstPaint.toFixed(2)}ms`,
    'First Contentful Paint': `${metrics.firstContentfulPaint.toFixed(2)}ms`,
  });
  
  return metrics;
}

/**
 * Valida se performance está dentro dos limites aceitáveis
 */
export function validatePerformance(
  metrics: PerformanceMetrics,
  thresholds: {
    maxDomContentLoaded?: number;
    maxLoadComplete?: number;
    maxFirstPaint?: number;
    maxFirstContentfulPaint?: number;
  }
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  
  if (thresholds.maxDomContentLoaded && metrics.domContentLoaded > thresholds.maxDomContentLoaded) {
    failures.push(
      `DOM Content Loaded (${metrics.domContentLoaded.toFixed(2)}ms) excede limite (${thresholds.maxDomContentLoaded}ms)`
    );
  }
  
  if (thresholds.maxLoadComplete && metrics.loadComplete > thresholds.maxLoadComplete) {
    failures.push(
      `Load Complete (${metrics.loadComplete.toFixed(2)}ms) excede limite (${thresholds.maxLoadComplete}ms)`
    );
  }
  
  if (thresholds.maxFirstPaint && metrics.firstPaint > thresholds.maxFirstPaint) {
    failures.push(
      `First Paint (${metrics.firstPaint.toFixed(2)}ms) excede limite (${thresholds.maxFirstPaint}ms)`
    );
  }
  
  if (thresholds.maxFirstContentfulPaint && metrics.firstContentfulPaint > thresholds.maxFirstContentfulPaint) {
    failures.push(
      `First Contentful Paint (${metrics.firstContentfulPaint.toFixed(2)}ms) excede limite (${thresholds.maxFirstContentfulPaint}ms)`
    );
  }
  
  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Monitora performance durante execução de ação
 */
export async function measureActionPerformance<T>(
  page: Page,
  action: () => Promise<T>,
  actionName: string
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await action();
  const duration = Date.now() - startTime;
  
  console.log(`⏱️  ${actionName} executado em ${duration}ms`);
  
  return { result, duration };
}



