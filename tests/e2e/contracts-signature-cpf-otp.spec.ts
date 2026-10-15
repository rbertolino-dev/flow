import { test, expect } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';

/**
 * Fluxo público de assinatura com CPF + OTP WhatsApp
 * Mocks das edge functions e do contrato — não depende de WhatsApp real.
 * @human-behavior
 */

const FAKE_CONTRACT_ID = '11111111-1111-4111-8111-111111111111';
const FAKE_TOKEN = 'e2e-signature-token-cpf-otp';
const VALID_CPF = '529.982.247-25';
const TEST_OTP = '654321';

test.describe('Contratos - Assinatura CPF + OTP @human-behavior', () => {
  let human: HumanBehavior;

  test.beforeEach(async ({ page }) => {
    human = new HumanBehavior(page);

    // Mock contrato (PostgREST)
    await page.route('**/rest/v1/contracts**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: FAKE_CONTRACT_ID,
            organization_id: '22222222-2222-4222-8222-222222222222',
            contract_number: 'CTR-E2E-OTP',
            content: '<p>Contrato de teste E2E</p>',
            pdf_url: null,
            status: 'sent',
            signature_token: FAKE_TOKEN,
            title: 'Contrato E2E OTP',
            acceptance_terms: 'Termos de teste E2E para aceite na assinatura.',
            lead: {
              id: '33333333-3333-4333-8333-333333333333',
              name: 'Cliente E2E',
              phone: '11999999999',
            },
            template: null,
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, body: JSON.stringify({}) });
    });

    await page.route('**/rest/v1/contract_signatures**', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        expect(body.signer_cpf).toBe('52998224725');
        expect(body.otp_verified).toBe(true);
        expect(body.identity_verification_method).toBe('cpf_whatsapp_otp');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '44444444-4444-4444-8444-444444444444',
            ...body,
            created_at: new Date().toISOString(),
          }),
        });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              signer_name: 'Cliente E2E',
              signature_data: 'data:image/png;base64,iVBORw0KGgo=',
              signed_at: new Date().toISOString(),
              signer_type: 'client',
              signer_cpf: '52998224725',
              otp_verified: true,
            },
          ]),
        });
        return;
      }
      await route.fulfill({ status: 200, body: '[]' });
    });

    await page.route('**/rest/v1/activities**', async (route) => {
      await route.fulfill({ status: 201, body: JSON.stringify({ id: 'act-1' }) });
    });

    await page.route('**/functions/v1/request-signature-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Código enviado por WhatsApp',
          masked_phone: '****9999',
          expires_in_seconds: 600,
          test_otp: TEST_OTP,
        }),
      });
    });

    await page.route('**/functions/v1/verify-signature-otp', async (route) => {
      const body = route.request().postDataJSON() as { code?: string };
      if (body?.code !== TEST_OTP) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Código incorreto' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          verification_token: 'e2e-verification-token',
          verified_at: new Date().toISOString(),
          signer_cpf: '52998224725',
          identity_verification_method: 'cpf_whatsapp_otp',
        }),
      });
    });

    await page.route('**/functions/v1/upload-signed-contract-pdf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          signed_pdf_url: 'https://example.com/signed.pdf',
        }),
      });
    });

    // ipify / geo — não bloquear
    await page.route('**/api.ipify.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ip: '1.2.3.4' }),
      });
    });
    await page.route('**/ipapi.co/**', async (route) => {
      await route.fulfill({ status: 200, body: 'BR' });
    });
  });

  test('deve assinar contrato com CPF, OTP e canvas', async ({ page }) => {
    await page.goto(`/sign-contract/${FAKE_CONTRACT_ID}/${FAKE_TOKEN}`);
    await page.waitForLoadState('domcontentloaded');
    await human.randomDelay(800, 1200);

    await expect(page.getByRole('heading', { name: /assinar contrato/i })).toBeVisible({
      timeout: 15000,
    });

    // Etapa 1: identidade
    const nameInput = page.getByTestId('signer-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('');
    await human.humanType(nameInput, 'João Silva Teste');
    await human.randomDelay(300, 500);

    const cpfInput = page.getByTestId('signer-cpf');
    await human.humanType(cpfInput, VALID_CPF.replace(/\D/g, ''));
    await human.randomDelay(400, 700);

    await human.hesitate(300, 600);
    await human.humanClick(page.getByTestId('send-otp-btn'));

    // Etapa 2: OTP
    await expect(page.getByTestId('otp-code')).toBeVisible({ timeout: 10000 });
    await human.humanType(page.getByTestId('otp-code'), TEST_OTP);
    await human.hesitate(200, 400);
    await human.humanClick(page.getByTestId('verify-otp-btn'));

    // Etapa 3: assinatura + leitura dos termos
    await expect(page.getByTestId('acceptance-terms-block')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Termos de teste E2E/i)).toBeVisible();
    await expect(page.getByTestId('accept-terms')).toBeVisible({ timeout: 10000 });

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 60);
      await page.mouse.move(box.x + 140, box.y + 35);
      await page.mouse.up();
    }
    await human.randomDelay(300, 500);

    const confirmSignatureBtn = page.getByRole('button', { name: /confirmar assinatura/i });
    await expect(confirmSignatureBtn).toBeEnabled({ timeout: 5000 });
    await human.humanClick(confirmSignatureBtn);

    await human.randomDelay(300, 500);
    await human.humanClick(page.getByTestId('accept-terms'));
    await human.hesitate(400, 800);

    const submitBtn = page.getByTestId('submit-signature-btn');
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await human.humanClick(submitBtn);

    await expect(page.getByTestId('sign-contract-success')).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByTestId('sign-contract-success').getByText(/assinado com sucesso/i),
    ).toBeVisible();
  });
});
