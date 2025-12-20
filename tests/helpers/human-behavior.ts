import { Page, Locator } from '@playwright/test';

/**
 * 🧑 Simula comportamento humano em testes E2E
 * 
 * Esta classe fornece métodos que simulam como um usuário real
 * interage com a aplicação, incluindo:
 * - Delays aleatórios (tempo de leitura/pensamento)
 * - Movimentos naturais do mouse
 * - Digitação com velocidade variável
 * - Scroll suave
 * - Pausas naturais
 */
export class HumanBehavior {
  constructor(private page: Page) {}

  /**
   * Clica em um elemento com movimento natural do mouse
   * Simula hover antes do click, como um humano faria
   */
  async humanClick(selector: string | Locator, options?: { timeout?: number }) {
    const element = typeof selector === 'string' 
      ? this.page.locator(selector) 
      : selector;
    
    // Hover primeiro (movimento natural)
    await element.hover({ force: false, timeout: options?.timeout });
    
    // Delay aleatório antes do click (tempo de "decisão")
    await this.randomDelay(100, 300);
    
    // Click
    await element.click({ timeout: options?.timeout });
    
    // Pequeno delay após click (tempo de processamento)
    await this.randomDelay(50, 150);
  }

  /**
   * Digita texto como um humano faria
   * Com delays variáveis entre cada tecla
   */
  async humanType(
    selector: string | Locator, 
    text: string, 
    options?: { clearFirst?: boolean; delay?: number }
  ) {
    const element = typeof selector === 'string' 
      ? this.page.locator(selector) 
      : selector;
    
    // Clicar no campo primeiro
    await element.click();
    await this.randomDelay(100, 200);
    
    // Limpar se necessário
    if (options?.clearFirst) {
      await element.clear();
      await this.randomDelay(50, 100);
    }
    
    // Digitar cada caractere com delay variável
    for (const char of text) {
      const delay = options?.delay || this.random(50, 150);
      await element.type(char, { delay });
      
      // Ocasionalmente pausar mais (simula pensamento)
      if (Math.random() < 0.1) {
        await this.randomDelay(200, 400);
      }
    }
    
    // Pequeno delay após terminar de digitar
    await this.randomDelay(100, 200);
  }

  /**
   * Preenche campo de forma mais natural
   * Útil para campos que não aceitam type() (como date pickers)
   */
  async humanFill(selector: string | Locator, value: string) {
    const element = typeof selector === 'string' 
      ? this.page.locator(selector) 
      : selector;
    
    await element.click();
    await this.randomDelay(100, 200);
    await element.fill(value);
    await this.randomDelay(100, 200);
  }

  /**
   * Scroll suave como um humano faria
   * Com pausas naturais
   */
  async humanScroll(
    direction: 'up' | 'down' | 'left' | 'right' = 'down',
    pixels: number = 300,
    steps: number = 3
  ) {
    const stepSize = pixels / steps;
    
    for (let i = 0; i < steps; i++) {
      const deltaX = direction === 'left' ? -stepSize : direction === 'right' ? stepSize : 0;
      const deltaY = direction === 'up' ? -stepSize : direction === 'down' ? stepSize : 0;
      
      await this.page.mouse.wheel(deltaX, deltaY);
      
      // Delay entre cada step (simula movimento natural)
      await this.randomDelay(100, 200);
    }
    
    // Pausa após scroll (tempo para ler)
    await this.randomDelay(300, 600);
  }

  /**
   * Navega para uma URL como um humano faria
   * Com pausas para "ler" a página
   */
  async humanNavigate(url: string, waitForLoad: boolean = true) {
    await this.page.goto(url);
    
    if (waitForLoad) {
      await this.page.waitForLoadState('networkidle');
    }
    
    // Tempo para "ler" a página (varia conforme complexidade)
    await this.randomDelay(500, 1500);
  }

  /**
   * Aguarda elemento aparecer com comportamento humano
   * Simula tempo de "procura" visual
   */
  async humanWaitFor(selector: string | Locator, timeout: number = 10000) {
    const element = typeof selector === 'string' 
      ? this.page.locator(selector) 
      : selector;
    
    // Pequeno delay antes de começar a procurar (simula tempo de leitura)
    await this.randomDelay(200, 400);
    
    await element.waitFor({ state: 'visible', timeout });
    
    // Delay após encontrar (tempo de "processamento visual")
    await this.randomDelay(100, 300);
  }

  /**
   * Seleciona opção de dropdown como humano
   * Com hover e delay antes de selecionar
   */
  async humanSelect(selector: string | Locator, value: string) {
    const element = typeof selector === 'string' 
      ? this.page.locator(selector) 
      : selector;
    
    await element.click();
    await this.randomDelay(200, 400); // Tempo para ler opções
    
    // Selecionar opção
    await this.page.getByRole('option', { name: new RegExp(value, 'i') }).click();
    await this.randomDelay(100, 200);
  }

  /**
   * Delay aleatório (simula tempo de leitura/pensamento)
   * Útil para pausas naturais entre ações
   */
  async randomDelay(min: number = 100, max: number = 500) {
    const delay = this.random(min, max);
    await this.page.waitForTimeout(delay);
  }

  /**
   * Simula leitura de texto na tela
   * Delay baseado no tamanho do texto
   */
  async simulateReading(text: string) {
    // Aproximadamente 200ms por palavra (velocidade de leitura média)
    const words = text.split(/\s+/).length;
    const readingTime = words * 200;
    await this.randomDelay(readingTime * 0.5, readingTime * 1.5);
  }

  /**
   * Simula pensamento/hesitação antes de ação importante
   * Útil antes de clicar em botões críticos (salvar, deletar, etc)
   */
  async hesitate(min: number = 500, max: number = 1500) {
    await this.randomDelay(min, max);
  }

  /**
   * Move mouse de forma natural entre elementos
   * Simula movimento humano (não em linha reta)
   * Nota: Esta função é opcional e pode não funcionar em todos os contextos
   */
  async humanMouseMove(x: number, y: number) {
    // Movimento simples do mouse com pequenas variações
    const steps = 10;
    const stepX = x / steps;
    const stepY = y / steps;
    
    for (let i = 1; i <= steps; i++) {
      const newX = stepX * i;
      const newY = stepY * i;
      
      // Adicionar pequena variação aleatória (movimento não linear)
      const variationX = this.random(-2, 2);
      const variationY = this.random(-2, 2);
      
      await this.page.mouse.move(newX + variationX, newY + variationY);
      await this.page.waitForTimeout(this.random(10, 20));
    }
  }

  /**
   * Gera número aleatório entre min e max
   */
  private random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

