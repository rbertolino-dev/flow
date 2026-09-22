import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

type SaleItemInput = {
  item_type: "product" | "service";
  item_id?: string | null;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
};

type PaymentInput = {
  method: string;
  amount: number;
};

async function getPostgresClient() {
  const postgresHost = Deno.env.get("POSTGRES_HOST") || "localhost";
  const postgresPort = parseInt(Deno.env.get("POSTGRES_PORT") || "5432");
  const postgresDb = Deno.env.get("POSTGRES_DB") || "budget_services";
  const postgresUser = Deno.env.get("POSTGRES_USER") || "budget_user";
  const postgresPassword = Deno.env.get("POSTGRES_PASSWORD");

  if (!postgresPassword) {
    throw new Error("POSTGRES_PASSWORD não configurada");
  }

  let finalHost = postgresHost;
  if (postgresHost === "localhost" || postgresHost === "127.0.0.1") {
    finalHost = Deno.env.get("POSTGRES_SERVER_IP") || "95.217.2.116";
  }

  const client = new Client({
    hostname: finalHost,
    port: postgresPort,
    database: postgresDb,
    user: postgresUser,
    password: postgresPassword,
    tls: { enforce: false, caCertificates: [] },
    connection: { keepAlive: true, connectTimeout: 10000 },
  });

  await client.connect();
  return client;
}

async function resolveOrganization(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  requestedOrgId: string | null
): Promise<string> {
  const { data: orgMembers, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  if (!orgMembers?.length) {
    throw new Error("Usuário não pertence a nenhuma organização");
  }

  const userOrgIds = orgMembers.map((m: { organization_id: string }) => m.organization_id);
  if (requestedOrgId && userOrgIds.includes(requestedOrgId)) {
    return requestedOrgId;
  }
  return orgMembers[0].organization_id;
}

async function getUserName(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name || null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? Number(value) : value
  ), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normaliza linhas do Postgres (BigInt → number, Date → ISO). */
function serializeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "bigint") out[k] = Number(v);
      else if (v instanceof Date) out[k] = v.toISOString();
      else out[k] = v;
    }
    return out as T;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let pg: Client | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) return json({ error: "Token inválido" }, 401);

    const organizationId = await resolveOrganization(
      supabase,
      user.id,
      req.headers.get("X-Organization-Id")
    );

    const userName = await getUserName(supabase, user.id);
    pg = await getPostgresClient();

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list_sales";

    // ---- GET: list sales / get sale / open cash session ----
    if (req.method === "GET") {
      if (action === "open_cash_session") {
        const result = await pg.queryObject`
          SELECT * FROM pos_cash_sessions
          WHERE organization_id = ${organizationId} AND status = 'open'
          ORDER BY opened_at DESC
          LIMIT 1
        `;
        return json({ data: result.rows[0] ? serializeRows([result.rows[0] as Record<string, unknown>])[0] : null });
      }

      if (action === "get_sale") {
        const saleId = url.searchParams.get("id");
        if (!saleId) return json({ error: "id obrigatório" }, 400);

        const sale = await pg.queryObject`
          SELECT * FROM pos_sales
          WHERE id = ${saleId} AND organization_id = ${organizationId}
          LIMIT 1
        `;
        if (!sale.rows.length) return json({ error: "Venda não encontrada" }, 404);

        const items = await pg.queryObject`
          SELECT * FROM pos_sale_items
          WHERE sale_id = ${saleId} AND organization_id = ${organizationId}
          ORDER BY created_at ASC
        `;
        const payments = await pg.queryObject`
          SELECT * FROM pos_sale_payments
          WHERE sale_id = ${saleId} AND organization_id = ${organizationId}
          ORDER BY created_at ASC
        `;

        return json({
          data: {
            ...serializeRows([sale.rows[0] as Record<string, unknown>])[0],
            items: serializeRows(items.rows as Record<string, unknown>[]),
            payments: serializeRows(payments.rows as Record<string, unknown>[]),
          },
        });
      }

      // list_sales (default)
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "35"), 100);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
      const search = url.searchParams.get("search")?.trim();

      let sales;
      if (search) {
        const like = `%${search}%`;
        sales = await pg.queryObject`
          SELECT * FROM pos_sales
          WHERE organization_id = ${organizationId}
            AND status = 'completed'
            AND (
              customer_name ILIKE ${like}
              OR customer_phone ILIKE ${like}
              OR CAST(sale_number AS TEXT) ILIKE ${like}
              OR notes ILIKE ${like}
            )
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        sales = await pg.queryObject`
          SELECT * FROM pos_sales
          WHERE organization_id = ${organizationId}
            AND status = 'completed'
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      return json({ data: serializeRows(sales.rows as Record<string, unknown>[]) });
    }

    // ---- POST actions ----
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const postAction = body.action || action;

      if (postAction === "open_cash") {
        const existing = await pg.queryObject`
          SELECT id FROM pos_cash_sessions
          WHERE organization_id = ${organizationId} AND status = 'open'
          LIMIT 1
        `;
        if (existing.rows.length) {
          return json({ data: existing.rows[0], message: "Já existe caixa aberto" });
        }

        const openingAmount = Number(body.opening_amount || 0);
        const result = await pg.queryObject`
          INSERT INTO pos_cash_sessions (
            organization_id, opened_by, opened_by_name, opening_amount, notes, status
          ) VALUES (
            ${organizationId}, ${user.id}, ${userName}, ${openingAmount},
            ${body.notes || null}, 'open'
          )
          RETURNING *
        `;
        return json({ data: result.rows[0] }, 201);
      }

      if (postAction === "close_cash") {
        const sessionId = body.session_id;
        if (!sessionId) return json({ error: "session_id obrigatório" }, 400);

        const result = await pg.queryObject`
          UPDATE pos_cash_sessions
          SET status = 'closed',
              closed_at = now(),
              closed_by = ${user.id},
              closed_by_name = ${userName},
              closing_amount = ${Number(body.closing_amount || 0)},
              notes = COALESCE(${body.notes || null}, notes)
          WHERE id = ${sessionId}
            AND organization_id = ${organizationId}
            AND status = 'open'
          RETURNING *
        `;
        if (!result.rows.length) {
          return json({ error: "Caixa aberto não encontrado" }, 404);
        }
        return json({ data: result.rows[0] });
      }

      if (postAction === "finalize_sale") {
        const items = (body.items || []) as SaleItemInput[];
        const payments = (body.payments || []) as PaymentInput[];

        if (!items.length) return json({ error: "Adicione ao menos um item" }, 400);
        if (!payments.length) return json({ error: "Adicione ao menos uma forma de pagamento" }, 400);

        for (const item of items) {
          if (!item.name || !item.quantity || item.quantity <= 0) {
            return json({ error: "Item inválido (nome/quantidade)" }, 400);
          }
          if (item.unit_price < 0) {
            return json({ error: "Preço inválido" }, 400);
          }
        }

        const discountAmount = Math.max(0, Number(body.discount_amount || 0));
        const addCommission = Boolean(body.add_commission);
        let subtotal = 0;
        const normalizedItems = items.map((item) => {
          const qty = Number(item.quantity);
          const unitPrice = Number(item.unit_price);
          const itemDiscount = Math.max(0, Number(item.discount_amount || 0));
          const totalPrice = Math.max(0, qty * unitPrice - itemDiscount);
          subtotal += totalPrice;
          return {
            ...item,
            quantity: qty,
            unit_price: unitPrice,
            discount_amount: itemDiscount,
            total_price: totalPrice,
            unit: item.unit || "un",
            item_type: item.item_type === "service" ? "service" : "product",
          };
        });

        const total = Math.max(0, subtotal - discountAmount);
        const paymentsTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        if (Math.abs(paymentsTotal - total) > 0.05) {
          return json({
            error: `Soma dos pagamentos (${paymentsTotal.toFixed(2)}) difere do total (${total.toFixed(2)})`,
          }, 400);
        }

        let commissionAmount = 0;
        if (addCommission) {
          for (const item of normalizedItems) {
            if (item.item_type !== "product" || !item.item_id) continue;
            const prod = await pg.queryObject<{
              commission_percentage: number | null;
              commission_fixed: number | null;
            }>`
              SELECT commission_percentage, commission_fixed
              FROM products
              WHERE id = ${item.item_id} AND organization_id = ${organizationId}
              LIMIT 1
            `;
            if (prod.rows[0]) {
              const pct = Number(prod.rows[0].commission_percentage || 0);
              const fixed = Number(prod.rows[0].commission_fixed || 0);
              commissionAmount += (item.total_price * pct) / 100 + fixed * item.quantity;
            }
          }
        }

        // Ensure open cash session (create if missing)
        let cashSessionId: string | null = body.cash_session_id || null;
        if (!cashSessionId) {
          const openCash = await pg.queryObject<{ id: string }>`
            SELECT id FROM pos_cash_sessions
            WHERE organization_id = ${organizationId} AND status = 'open'
            ORDER BY opened_at DESC LIMIT 1
          `;
          if (openCash.rows[0]) {
            cashSessionId = openCash.rows[0].id;
          } else {
            const created = await pg.queryObject<{ id: string }>`
              INSERT INTO pos_cash_sessions (
                organization_id, opened_by, opened_by_name, opening_amount, status
              ) VALUES (
                ${organizationId}, ${user.id}, ${userName}, 0, 'open'
              )
              RETURNING id
            `;
            cashSessionId = created.rows[0].id;
          }
        }

        const tx = pg;
        await tx.queryArray`BEGIN`;

        try {
          const counter = await tx.queryObject<{ last_number: string }>`
            INSERT INTO pos_sale_counters (organization_id, last_number)
            VALUES (${organizationId}, 1)
            ON CONFLICT (organization_id)
            DO UPDATE SET last_number = pos_sale_counters.last_number + 1
            RETURNING last_number
          `;
          const saleNumber = Number(counter.rows[0].last_number);

          const saleResult = await tx.queryObject<{ id: string; sale_number: string }>`
            INSERT INTO pos_sales (
              organization_id, sale_number, cash_session_id,
              lead_id, customer_name, customer_phone,
              status, subtotal, discount_amount, total,
              notes, add_commission, commission_amount,
              sold_by, sold_by_name
            ) VALUES (
              ${organizationId}, ${saleNumber}, ${cashSessionId},
              ${body.lead_id || null}, ${body.customer_name || null}, ${body.customer_phone || null},
              'completed', ${subtotal}, ${discountAmount}, ${total},
              ${body.notes || null}, ${addCommission}, ${commissionAmount},
              ${user.id}, ${userName}
            )
            RETURNING id, sale_number
          `;

          const saleId = saleResult.rows[0].id;

          for (const item of normalizedItems) {
            await tx.queryArray`
              INSERT INTO pos_sale_items (
                sale_id, organization_id, item_type, item_id,
                name, sku, unit, quantity, unit_price, discount_amount, total_price
              ) VALUES (
                ${saleId}, ${organizationId}, ${item.item_type}, ${item.item_id || null},
                ${item.name}, ${item.sku || null}, ${item.unit},
                ${item.quantity}, ${item.unit_price}, ${item.discount_amount}, ${item.total_price}
              )
            `;

            if (item.item_type === "product" && item.item_id) {
              const stockRow = await tx.queryObject<{ stock_quantity: number | null }>`
                SELECT stock_quantity FROM products
                WHERE id = ${item.item_id} AND organization_id = ${organizationId}
                FOR UPDATE
              `;

              if (stockRow.rows.length) {
                const before = Number(stockRow.rows[0].stock_quantity ?? 0);
                const after = before - item.quantity;

                await tx.queryArray`
                  UPDATE products
                  SET stock_quantity = ${after}, updated_at = now()
                  WHERE id = ${item.item_id} AND organization_id = ${organizationId}
                `;

                await tx.queryArray`
                  INSERT INTO pos_stock_movements (
                    organization_id, product_id, sale_id, movement_type,
                    quantity_delta, stock_before, stock_after, created_by
                  ) VALUES (
                    ${organizationId}, ${item.item_id}, ${saleId}, 'sale',
                    ${-item.quantity}, ${before}, ${after}, ${user.id}
                  )
                `;
              }
            }
          }

          for (const payment of payments) {
            await tx.queryArray`
              INSERT INTO pos_sale_payments (sale_id, organization_id, method, amount)
              VALUES (
                ${saleId}, ${organizationId},
                ${String(payment.method)}, ${Number(payment.amount)}
              )
            `;
          }

          await tx.queryArray`COMMIT`;

          return json({
            data: {
              id: saleId,
              sale_number: saleNumber,
              total,
              subtotal,
              discount_amount: discountAmount,
              commission_amount: commissionAmount,
              cash_session_id: cashSessionId,
            },
          }, 201);
        } catch (txErr) {
          await tx.queryArray`ROLLBACK`;
          throw txErr;
        }
      }

      return json({ error: `Ação desconhecida: ${postAction}` }, 400);
    }

    return json({ error: "Método não suportado" }, 405);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pos-sales]", message);
    return json({ error: message }, 500);
  } finally {
    if (pg) {
      try {
        await pg.end();
      } catch {
        // ignore
      }
    }
  }
});
