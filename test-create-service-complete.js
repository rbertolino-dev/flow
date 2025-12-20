// Teste completo: Criar serviço, ver logs, corrigir até funcionar
import { chromium } from 'playwright';

async function testCreateServiceComplete() {
  console.log('🧪 TESTE COMPLETO - Criar Serviço');
  console.log('==================================\n');

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Capturar TODOS os logs e erros
    const allLogs = [];
    const errors = [];
    const networkRequests = [];
    const networkResponses = [];

    page.on('console', msg => {
      const text = msg.text();
      allLogs.push({ type: msg.type(), text });
      if (msg.type() === 'error' || text.includes('404') || text.includes('get-services')) {
        errors.push(text);
        console.log(`📡 Console [${msg.type()}]: ${text}`);
      }
    });

    page.on('request', request => {
      const url = request.url();
      // Capturar TODAS as requisições para análise
      if (url.includes('get-services') || url.includes('functions/v1') || url.includes('supabase')) {
        networkRequests.push({
          url,
          method: request.method(),
          headers: Object.fromEntries(Object.entries(request.headers())),
          timestamp: new Date().toISOString(),
        });
        console.log(`📤 Request: ${request.method()} ${url}`);
      }
    });

    page.on('response', async response => {
      const url = response.url();
      // Capturar TODAS as respostas relacionadas
      if (url.includes('get-services') || url.includes('functions/v1') || 
          (url.includes('supabase') && url.includes('functions'))) {
        const status = response.status();
        let text = '';
        try {
          text = await response.text();
        } catch (e) {
          text = 'Não foi possível ler resposta';
        }
        networkResponses.push({
          url,
          status,
          ok: response.ok(),
          text: text.substring(0, 500),
          timestamp: new Date().toISOString(),
        });
        console.log(`📥 Response: ${status} ${url}`);
        if (status === 404) {
          console.error(`   ❌ ERRO 404 DETECTADO!`);
          console.error(`   Response: ${text.substring(0, 200)}`);
        } else if (status === 401) {
          console.log(`   ⚠️  401 - Precisa autenticação`);
        } else if (response.ok) {
          console.log(`   ✅ Sucesso!`);
          try {
            const json = JSON.parse(text);
            console.log(`   Data: ${JSON.stringify(json).substring(0, 200)}`);
          } catch (e) {
            console.log(`   Text: ${text.substring(0, 200)}`);
          }
        }
      }
    });

    console.log('1️⃣ Navegando para a aplicação...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    console.log('2️⃣ Navegando para /budgets...');
    await page.goto('http://localhost:3000/budgets', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    console.log('3️⃣ Procurando botão "Criar Orçamento"...');
    let createBudgetButton = null;
    try {
      // Tentar vários seletores
      const selectors = [
        'button:has-text("Criar")',
        'button:has-text("Novo")',
        '[data-testid*="create"]',
        'button[aria-label*="criar" i]',
      ];
      
      for (const selector of selectors) {
        try {
          const btn = await page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            createBudgetButton = btn;
            console.log(`   ✅ Botão encontrado: ${selector}`);
            break;
          }
        } catch (e) {}
      }
      
      if (createBudgetButton) {
        await createBudgetButton.click();
        console.log('   ✅ Clicado!');
        await page.waitForTimeout(2000);
      } else {
        console.log('   ⚠️  Botão não encontrado, tentando abrir dialog diretamente');
        // Tentar abrir via JavaScript
        await page.evaluate(() => {
          const event = new CustomEvent('openCreateBudget');
          window.dispatchEvent(event);
        });
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log(`   ⚠️  Erro: ${error.message}`);
    }

    console.log('4️⃣ Procurando botão "Criar Serviço"...');
    let createServiceButton = null;
    try {
      const serviceSelectors = [
        'button:has-text("Criar Serviço")',
        'button:has-text("Criar Novo Serviço")',
        'button:has-text("Novo Serviço")',
        '[data-testid*="create-service"]',
        'button[aria-label*="serviço" i]',
      ];

      for (const selector of serviceSelectors) {
        try {
          const btn = await page.locator(selector).first();
          if (await btn.isVisible({ timeout: 3000 })) {
            createServiceButton = btn;
            console.log(`   ✅ Botão encontrado: ${selector}`);
            break;
          }
        } catch (e) {}
      }

      if (createServiceButton) {
        await createServiceButton.click();
        console.log('   ✅ Clicado!');
        // Aguardar dialog aparecer completamente
        await page.waitForTimeout(1000);
        // Aguardar por input visível no dialog e capturar screenshot
        try {
          await page.waitForSelector('input[id="service-name"]', {
            timeout: 5000,
            state: 'visible'
          });
          console.log('   ✅ Dialog carregado com campo service-name');
          
          // Capturar screenshot do dialog
          const dialog = await page.locator('[role="dialog"]').first();
          if (await dialog.isVisible()) {
            await dialog.screenshot({ path: '/tmp/dialog-screenshot.png' });
            console.log('   📸 Screenshot do dialog salvo');
          }
        } catch (e) {
          console.log('   ⚠️  Campo service-name não encontrado, tentando outros...');
          // Tentar encontrar qualquer input no dialog
          const dialogInputs = await page.locator('[role="dialog"] input, [data-state="open"] input').count();
          console.log(`   📋 Inputs encontrados no dialog: ${dialogInputs}`);
        }
        await page.waitForTimeout(1000);
      } else {
        console.log('   ⚠️  Botão não encontrado na página');
        // Tentar via JavaScript
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const createBtn = buttons.find(b => 
            b.textContent?.toLowerCase().includes('criar') && 
            b.textContent?.toLowerCase().includes('serviço')
          );
          if (createBtn) createBtn.click();
        });
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      console.log(`   ⚠️  Erro: ${error.message}`);
    }

    console.log('5️⃣ Preenchendo formulário de serviço...');
    try {
      // Procurar campos do formulário DENTRO do dialog
      const nameSelectors = [
        '[role="dialog"] input[id*="service-name"]',
        '[role="dialog"] input[placeholder*="nome" i]',
        '[data-state="open"] input[id*="service-name"]',
        'input[id="service-name"]',
        'input[placeholder*="Ex: Instalação" i]',
      ];

      // Primeiro, verificar se o dialog está aberto
      const dialogInfo = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"], [data-state="open"]');
        return {
          count: dialogs.length,
          inputs: Array.from(dialogs).flatMap(d => 
            Array.from(d.querySelectorAll('input')).map(inp => ({
              id: inp.id,
              type: inp.type,
              placeholder: inp.placeholder,
              visible: inp.offsetParent !== null,
            }))
          ),
        };
      });
      console.log(`   📋 Dialog info: ${dialogInfo.count} dialogs, ${dialogInfo.inputs.length} inputs`);
      dialogInfo.inputs.forEach(inp => {
        console.log(`      - Input: id="${inp.id}", type="${inp.type}", visible=${inp.visible}`);
      });
      
      let nameInput = null;
      // Tentar primeiro o ID exato
      try {
        nameInput = await page.locator('input[id="service-name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 })) {
          console.log('   ✅ Campo service-name encontrado pelo ID exato');
        } else {
          nameInput = null;
        }
      } catch (e) {}
      
      // Se não encontrou, tentar outros seletores
      if (!nameInput) {
        for (const selector of nameSelectors) {
          try {
            const input = await page.locator(selector).first();
            if (await input.isVisible({ timeout: 2000 })) {
              nameInput = input;
              console.log(`   ✅ Campo encontrado com: ${selector}`);
              break;
            }
          } catch (e) {}
        }
      }

      if (nameInput) {
        // Usar evaluate para preencher e disparar eventos React corretamente
        await nameInput.evaluate((input, value) => {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, value);
          
          // Disparar eventos React
          const event = new Event('input', { bubbles: true });
          input.dispatchEvent(event);
          
          const changeEvent = new Event('change', { bubbles: true });
          input.dispatchEvent(changeEvent);
          
          // Tentar React synthetic events
          const reactEvent = new Event('input', { bubbles: true, cancelable: true });
          Object.defineProperty(reactEvent, 'target', { value: input, enumerable: true });
          input.dispatchEvent(reactEvent);
        }, 'Serviço Teste Automatizado');
        
        await page.waitForTimeout(500);
        console.log('   ✅ Nome preenchido via evaluate');
      } else {
        console.log('   ⚠️  Campo nome não encontrado, tentando via JavaScript');
        await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input[id*="name"]'));
          const nameInput = inputs.find(inp => 
            inp.id?.includes('name') || 
            inp.placeholder?.toLowerCase().includes('nome')
          ) || inputs[0];
          if (nameInput) {
            nameInput.focus();
            nameInput.value = 'Serviço Teste Automatizado';
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            nameInput.dispatchEvent(new Event('blur', { bubbles: true }));
          }
        });
        await page.waitForTimeout(300);
      }

      // Preencher preço DENTRO do dialog
      const priceSelectors = [
        '[role="dialog"] input[id*="service-price"]',
        '[role="dialog"] input[id="service-price"]',
        '[data-state="open"] input[id*="service-price"]',
        'input[id="service-price"]',
      ];

      let priceInput = null;
      for (const selector of priceSelectors) {
        try {
          const inputs = await page.locator(selector).all();
          for (const input of inputs) {
            if (await input.isVisible({ timeout: 1000 })) {
              const id = await input.getAttribute('id').catch(() => '');
              if (id.includes('price') || !id.includes('quantity')) {
                priceInput = input;
                break;
              }
            }
          }
          if (priceInput) break;
        } catch (e) {}
      }

      if (priceInput) {
        // Usar evaluate para preencher e disparar eventos React corretamente
        await priceInput.evaluate((input, value) => {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, value);
          
          // Disparar eventos React
          const event = new Event('input', { bubbles: true });
          input.dispatchEvent(event);
          
          const changeEvent = new Event('change', { bubbles: true });
          input.dispatchEvent(changeEvent);
          
          // Tentar React synthetic events
          const reactEvent = new Event('input', { bubbles: true, cancelable: true });
          Object.defineProperty(reactEvent, 'target', { value: input, enumerable: true });
          input.dispatchEvent(reactEvent);
        }, '150.00');
        
        await page.waitForTimeout(500);
        console.log('   ✅ Preço preenchido via evaluate');
      } else {
        console.log('   ⚠️  Campo preço não encontrado, tentando via JavaScript');
        await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="number"], input[id*="price"]'));
          const priceInput = inputs.find(inp => 
            inp.id?.includes('price') || 
            inp.placeholder?.toLowerCase().includes('preço')
          ) || inputs[0];
          if (priceInput) {
            priceInput.focus();
            priceInput.value = '150.00';
            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
            priceInput.dispatchEvent(new Event('change', { bubbles: true }));
            priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
          }
        });
        await page.waitForTimeout(300);
      }
      
      // Verificar se os campos estão preenchidos ANTES de continuar
      await page.waitForTimeout(500);
      const formState = await page.evaluate(() => {
        // Procurar APENAS dentro do dialog
        const dialog = document.querySelector('[role="dialog"], [data-state="open"]');
        if (!dialog) {
          return { error: 'Dialog não encontrado', name: '', price: '' };
        }
        
        const nameInput = dialog.querySelector('input[id*="service-name"], input[id="service-name"]');
        const priceInput = dialog.querySelector('input[id*="service-price"], input[id="service-price"]');
        return {
          name: nameInput?.value || '',
          price: priceInput?.value || '',
          nameId: nameInput?.id || '',
          priceId: priceInput?.id || '',
          dialogFound: true,
        };
      });
      console.log(`   📋 Estado do formulário: Nome="${formState.name}", Preço="${formState.price}"`);
      console.log(`   📋 IDs: Nome="${formState.nameId}", Preço="${formState.priceId}"`);
      
      // Se os campos ainda estão vazios, tentar preencher novamente de forma mais agressiva
      if (!formState.name || formState.price === '0' || !formState.price) {
        console.log('   ⚠️  Campos ainda vazios, tentando preencher novamente...');
        await page.evaluate(() => {
          // Encontrar inputs no dialog
          const dialog = document.querySelector('[role="dialog"], [data-state="open"]');
          if (dialog) {
            const nameInput = dialog.querySelector('input[id*="name"], input[placeholder*="nome" i]') ||
                             dialog.querySelector('input[type="text"]');
            const priceInput = dialog.querySelector('input[id*="price"]') ||
                             dialog.querySelector('input[type="number"]');
            
            if (nameInput) {
              nameInput.focus();
              nameInput.value = 'Serviço Teste Automatizado';
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeInputValueSetter.call(nameInput, 'Serviço Teste Automatizado');
              nameInput.dispatchEvent(new Event('input', { bubbles: true }));
              nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            if (priceInput) {
              priceInput.focus();
              priceInput.value = '150.00';
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeInputValueSetter.call(priceInput, '150.00');
              priceInput.dispatchEvent(new Event('input', { bubbles: true }));
              priceInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
        await page.waitForTimeout(500);
        
        // Verificar novamente
        const formState2 = await page.evaluate(() => {
          const nameInput = document.querySelector('input[id*="service-name"], input[placeholder*="nome" i]');
          const priceInput = document.querySelector('input[id*="service-price"], input[type="number"]');
          return {
            name: nameInput?.value || '',
            price: priceInput?.value || '',
          };
        });
        console.log(`   📋 Estado após segunda tentativa: Nome="${formState2.name}", Preço="${formState2.price}"`);
      }

      // Preencher descrição (opcional)
      try {
        const descInput = await page.locator('textarea').first();
        if (await descInput.isVisible({ timeout: 2000 })) {
          await descInput.fill('Descrição do serviço teste');
          console.log('   ✅ Descrição preenchida');
        }
      } catch (e) {}

    } catch (error) {
      console.log(`   ⚠️  Erro ao preencher: ${error.message}`);
    }

    console.log('6️⃣ Clicando em "Criar" ou "Criar e Adicionar"...');
    await page.waitForTimeout(1000);
    
    try {
      const submitSelectors = [
        'button:has-text("Criar e Adicionar")',
        'button:has-text("Criar Serviço")',
        'button:has-text("Criar")',
        'button[type="submit"]',
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const btn = await page.locator(selector).last();
          if (await btn.isVisible({ timeout: 2000 })) {
            console.log(`   ✅ Botão encontrado: ${selector}`);
            await btn.click();
            submitted = true;
            console.log('   ✅ Clicado! Aguardando resposta...');
            break;
          }
        } catch (e) {}
      }

      if (!submitted) {
        console.log('   ⚠️  Botão não encontrado, tentando via JavaScript');
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const submitBtn = buttons.find(b => 
            b.textContent?.toLowerCase().includes('criar') &&
            (b.textContent?.toLowerCase().includes('serviço') || 
             b.textContent?.toLowerCase().includes('adicionar'))
          );
          if (submitBtn && !submitBtn.disabled) {
            submitBtn.click();
          }
        });
      }
      
      // Verificar se o botão está desabilitado ANTES de clicar
      const buttonState = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return { found: false, disabled: true, error: 'Dialog não encontrado' };
        
        const buttons = Array.from(dialog.querySelectorAll('button'));
        const submitBtn = buttons.find(b => 
          b.textContent?.toLowerCase().includes('criar') &&
          (b.textContent?.toLowerCase().includes('serviço') || 
           b.textContent?.toLowerCase().includes('adicionar'))
        );
        
        // Verificar também o estado do input
        const nameInput = dialog.querySelector('input[id="service-name"]');
        const priceInput = dialog.querySelector('input[id="service-price"]');
        
        return {
          found: !!submitBtn,
          disabled: submitBtn?.disabled || false,
          text: submitBtn?.textContent || '',
          nameValue: nameInput?.value || '',
          priceValue: priceInput?.value || '',
          nameInState: nameInput ? (nameInput._valueTracker?.getValue?.() || nameInput.value) : '',
        };
      });
      console.log(`   📋 Estado do botão: ${JSON.stringify(buttonState)}`);
      
      if (buttonState.disabled) {
        console.log('   ⚠️  Botão está desabilitado!');
        console.log(`   📋 Valores: Nome="${buttonState.nameValue}", Preço="${buttonState.priceValue}"`);
        console.log('   🔧 Tentando forçar habilitação do botão...');
        
        // Tentar preencher novamente e aguardar React atualizar
        await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (dialog) {
            const nameInput = dialog.querySelector('input[id="service-name"]');
            const priceInput = dialog.querySelector('input[id="service-price"]');
            
            if (nameInput) {
              nameInput.focus();
              nameInput.value = 'Serviço Teste Automatizado';
              // Disparar todos os eventos possíveis
              ['focus', 'input', 'change', 'blur'].forEach(eventType => {
                nameInput.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
              });
            }
            
            if (priceInput) {
              priceInput.focus();
              priceInput.value = '150.00';
              ['focus', 'input', 'change', 'blur'].forEach(eventType => {
                priceInput.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
              });
            }
          }
        });
        
        await page.waitForTimeout(1000);
        
        // Verificar novamente
        const buttonState2 = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          const submitBtn = dialog?.querySelector('button:has-text("Criar")');
          const nameInput = dialog?.querySelector('input[id="service-name"]');
          return {
            disabled: submitBtn?.disabled || false,
            nameValue: nameInput?.value || '',
          };
        });
        console.log(`   📋 Estado após correção: disabled=${buttonState2.disabled}, name="${buttonState2.nameValue}"`);
      }

      // Aguardar requisições e respostas
      console.log('   ⏳ Aguardando requisições de rede...');
      
      // Aguardar por resposta específica ou timeout
      let responseReceived = false;
      try {
        const response = await page.waitForResponse(
          response => {
            const url = response.url();
            const isGetServices = url.includes('get-services') || 
                                 (url.includes('functions/v1') && url.includes('services'));
            if (isGetServices) {
              console.log(`   📥 Resposta detectada: ${response.status()} ${url}`);
              responseReceived = true;
            }
            return isGetServices && response.status() !== 0;
          },
          { timeout: 15000 }
        );
        console.log(`   ✅ Resposta recebida! Status: ${response.status()}`);
      } catch (e) {
        if (!responseReceived) {
          console.log('   ⚠️  Timeout aguardando resposta...');
          console.log('   🔍 Verificando se há erros que impedem a requisição...');
        }
      }
      
      // Aguardar mais um pouco para capturar todas as requisições
      await page.waitForTimeout(5000);
      
      // Verificar se há erros de validação ou outros problemas
      const validationErrors = await page.evaluate(() => {
        const errors = [];
        // Procurar por mensagens de erro
        const errorElements = document.querySelectorAll('[role="alert"], .error, [class*="error"], [class*="invalid"]');
        errorElements.forEach(el => {
          if (el.textContent && el.textContent.trim()) {
            errors.push(el.textContent.trim());
          }
        });
        return errors;
      });
      
      if (validationErrors.length > 0) {
        console.log('   ❌ Erros de validação encontrados:');
        validationErrors.forEach(err => console.error(`      - ${err}`));
      }
      
      // Verificar se há erros no console após o clique
      console.log('   🔍 Verificando console por erros...');
      const consoleAfterClick = await page.evaluate(() => {
        // Tentar capturar erros que possam ter ocorrido
        return window.console._errors || [];
      }).catch(() => []);
      
      if (consoleAfterClick.length > 0) {
        console.log('   📋 Erros no console após clique:');
        consoleAfterClick.forEach(err => console.error(`      - ${err}`));
      }
      
      // Verificar se há mensagens de sucesso/erro na página
      const pageMessages = await page.evaluate(() => {
        const messages = [];
        // Procurar por toasts, alerts, ou mensagens de sucesso/erro
        const elements = document.querySelectorAll('[role="alert"], .toast, .notification, [class*="success"], [class*="error"]');
        elements.forEach(el => {
          if (el.textContent) messages.push(el.textContent);
        });
        return messages;
      });
      
      if (pageMessages.length > 0) {
        console.log('   📋 Mensagens na página:');
        pageMessages.forEach(msg => console.log(`      - ${msg}`));
      }

    } catch (error) {
      console.log(`   ⚠️  Erro ao clicar: ${error.message}`);
    }

    // Analisar resultados
    console.log('\n📊 ANÁLISE DOS RESULTADOS:');
    console.log('==========================\n');

    console.log('📡 REQUISIÇÕES DE REDE:');
    networkRequests.forEach((req, i) => {
      console.log(`   ${i + 1}. ${req.method} ${req.url}`);
    });

    console.log('\n📥 RESPOSTAS:');
    networkResponses.forEach((res, i) => {
      console.log(`   ${i + 1}. Status ${res.status} - ${res.url}`);
      if (res.status === 404) {
        console.error(`      ❌ ERRO 404!`);
        console.error(`      Response: ${res.text.substring(0, 200)}`);
      } else if (res.status === 401) {
        console.log(`      ⚠️  401 - Precisa autenticação`);
      } else if (res.ok) {
        console.log(`      ✅ Sucesso!`);
        console.log(`      Response: ${res.text.substring(0, 200)}`);
      }
    });

    console.log('\n❌ ERROS ENCONTRADOS:');
    const getServicesErrors = errors.filter(e => 
      e.includes('get-services') || e.includes('404')
    );
    if (getServicesErrors.length > 0) {
      getServicesErrors.forEach((err, i) => {
        console.error(`   ${i + 1}. ${err}`);
      });
    } else {
      console.log('   ✅ Nenhum erro relacionado a get-services encontrado');
    }

    // Verificar se houve sucesso
    const has404 = networkResponses.some(r => r.status === 404) || 
                   getServicesErrors.length > 0;
    const hasSuccess = networkResponses.some(r => r.ok && r.status !== 401);

    console.log('\n==================================');
    console.log('📊 RESULTADO FINAL:');
    if (has404) {
      console.log('   ❌ ERRO 404 DETECTADO - Função não encontrada');
      console.log('   🔧 Ação necessária: Verificar deploy da função');
      return { success: false, errors: getServicesErrors, responses: networkResponses };
    } else if (hasSuccess) {
      console.log('   ✅ SUCESSO! Serviço criado com sucesso');
      return { success: true, responses: networkResponses };
    } else {
      console.log('   ⚠️  Nenhuma requisição bem-sucedida detectada');
      console.log('   ℹ️  Pode precisar de autenticação ou formulário não foi submetido');
      return { success: false, needsAuth: true, responses: networkResponses };
    }

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

// Executar teste
const result = await testCreateServiceComplete();

// Se falhou, tentar corrigir
if (!result.success && result.errors) {
  console.log('\n🔧 TENTANDO CORRIGIR PROBLEMAS...');
  console.log('Verificando função e corrigindo...');
  
  // Aqui você pode adicionar lógica para corrigir automaticamente
  // Por exemplo, redeploy da função, verificar configuração, etc.
}

process.exit(result.success ? 0 : 1);

