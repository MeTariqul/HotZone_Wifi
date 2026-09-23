import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(url);
}

let _initialized = false;

async function initDb(): Promise<void> {
  if (_initialized) return;
  const sql = getSql();
  
  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      download_kbps INTEGER NOT NULL,
      upload_kbps INTEGER NOT NULL,
      price_bdt INTEGER NOT NULL,
      active INTEGER DEFAULT 1
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vouchers (
      code TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      download_kbps INTEGER NOT NULL,
      upload_kbps INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      used_by_mac TEXT,
      used_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      voucher_code TEXT,
      status TEXT DEFAULT 'pending',
      amount_bdt INTEGER NOT NULL,
      discount_code TEXT,
      original_amount_bdt INTEGER,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS discount_codes (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value INTEGER NOT NULL,
      plan_id TEXT,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `;

  await sql`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'payment'`;
  await sql`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS note TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS router_snapshots (
      kind TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS router_commands (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      code TEXT,
      ip TEXT,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      created_at INTEGER NOT NULL,
      claimed_at INTEGER,
      completed_at INTEGER
    );
  `;
  await sql`ALTER TABLE router_commands ADD COLUMN IF NOT EXISTS claimed_at INTEGER`;
  await sql`ALTER TABLE router_commands ADD COLUMN IF NOT EXISTS payload TEXT`;

  const count = await sql`SELECT COUNT(*) as c FROM plans`;
  if (Number(count[0].c) === 0) {
    await sql`
      INSERT INTO plans (id, name, duration_seconds, download_kbps, upload_kbps, price_bdt)
      VALUES 
        ('trial', 'Trial', 1800, 2048, 1024, 0),
        ('hourly', 'Hourly', 3600, 5120, 1024, 20),
        ('daily', 'Daily', 86400, 10240, 2048, 50),
        ('weekly', 'Weekly', 604800, 5120, 2048, 200),
        ('monthly', 'Monthly', 2592000, 10240, 2048, 500)
    `;
  }
  
  _initialized = true;
}

export interface Plan {
  id: string;
  name: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  price_bdt: number;
  active: number;
}

export interface Voucher {
  code: string;
  plan_id: string;
  duration_seconds: number;
  download_kbps: number;
  upload_kbps: number;
  used: number;
  used_by_mac: string | null;
  used_at: number | null;
  created_at: number;
  source: string;
  note: string | null;
}

export interface Payment {
  id: string;
  plan_id: string;
  voucher_code: string | null;
  status: string;
  amount_bdt: number;
  discount_code: string | null;
  original_amount_bdt: number | null;
  created_at: number;
  completed_at: number | null;
}

export interface DiscountCode {
  code: string;
  type: 'percent' | 'fixed' | 'free';
  value: number;
  plan_id: string | null;
  max_uses: number;
  used_count: number;
  active: number;
  expires_at: number | null;
  created_at: number;
}

export function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = [];
  for (let s = 0; s < 2; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return `T-${segments[0]}-${segments[1]}`;
}

export function generateDiscountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getPlans(): Promise<Plan[]> {
  await initDb();
  const sql = getSql();
  return (await sql`SELECT * FROM plans WHERE active = 1`) as Plan[];
}

export async function getPlan(id: string): Promise<Plan | undefined> {
  await initDb();
  const sql = getSql();
  const result = await sql`SELECT * FROM plans WHERE id = ${id}`;
  return result[0] as Plan | undefined;
}

export async function createPayment(planId: string, discountCode?: string): Promise<Payment> {
  await initDb();
  const sql = getSql();
  const plan = await getPlan(planId);
  if (!plan) throw new Error('Plan not found');

  const now = Math.floor(Date.now() / 1000);
  let amount = plan.price_bdt;
  let appliedCode: string | null = null;
  let originalAmount: number | null = null;

  if (discountCode) {
    const normalized = discountCode.trim().toUpperCase();
    const claimed = await sql`
      UPDATE discount_codes
      SET used_count = used_count + 1
      WHERE code = ${normalized}
        AND active = 1
        AND used_count < max_uses
        AND (expires_at IS NULL OR expires_at > ${now})
        AND (plan_id IS NULL OR plan_id = ${planId})
      RETURNING *
    `;
    if (claimed.length === 0) {
      throw new Error('Invalid or exhausted discount code');
    }
    const dc = claimed[0] as DiscountCode;
    originalAmount = plan.price_bdt;
    if (dc.type === 'free') {
      amount = 0;
    } else if (dc.type === 'percent') {
      amount = Math.max(0, Math.round(plan.price_bdt * (100 - dc.value) / 100));
    } else {
      amount = Math.max(0, plan.price_bdt - dc.value);
    }
    appliedCode = normalized;
  }

  const id = uuidv4();
  await sql`
    INSERT INTO payments (id, plan_id, amount_bdt, discount_code, original_amount_bdt, created_at)
    VALUES (${id}, ${planId}, ${amount}, ${appliedCode}, ${originalAmount}, ${now})
  `;
  return {
    id,
    plan_id: planId,
    voucher_code: null,
    status: 'pending',
    amount_bdt: amount,
    discount_code: appliedCode,
    original_amount_bdt: originalAmount,
    created_at: now,
    completed_at: null,
  };
}

export async function completePayment(paymentId: string): Promise<{ payment: Payment; voucher: Voucher }> {
  await initDb();
  const sql = getSql();
  const paymentResult = await sql`SELECT * FROM payments WHERE id = ${paymentId}`;
  const payment = paymentResult[0] as Payment | undefined;
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'pending') throw new Error('Payment already processed');

  const plan = await getPlan(payment.plan_id);
  if (!plan) throw new Error('Plan not found');

  const code = generateVoucherCode();
  const now = Math.floor(Date.now() / 1000);

  await sql`
    INSERT INTO vouchers (code, plan_id, duration_seconds, download_kbps, upload_kbps, created_at, source, note)
    VALUES (${code}, ${plan.id}, ${plan.duration_seconds}, ${plan.download_kbps}, ${plan.upload_kbps}, ${now}, 'payment', ${payment.discount_code})
  `;

  await sql`
    UPDATE payments SET status = 'completed', voucher_code = ${code}, completed_at = ${now} WHERE id = ${paymentId}
  `;

  const voucher: Voucher = {
    code,
    plan_id: plan.id,
    duration_seconds: plan.duration_seconds,
    download_kbps: plan.download_kbps,
    upload_kbps: plan.upload_kbps,
    used: 0,
    used_by_mac: null,
    used_at: null,
    created_at: now,
    source: 'payment',
    note: payment.discount_code,
  };

  return {
    payment: { ...payment, status: 'completed', voucher_code: code, completed_at: now },
    voucher,
  };
}

export async function getVouchers(): Promise<Voucher[]> {
  await initDb();
  const sql = getSql();
  return (await sql`SELECT * FROM vouchers ORDER BY created_at DESC`) as Voucher[];
}

export async function getVoucher(code: string): Promise<Voucher | undefined> {
  await initDb();
  const sql = getSql();
  const result = await sql`SELECT * FROM vouchers WHERE code = ${code}`;
  return result[0] as Voucher | undefined;
}

export async function getNewVouchers(since: number): Promise<Array<{ code: string; plan: string; duration: number; dl: number; ul: number }>> {
  await initDb();
  const sql = getSql();
  const vouchers = await sql`
    SELECT v.code, p.id as plan, v.duration_seconds, v.download_kbps, v.upload_kbps
    FROM vouchers v
    JOIN plans p ON v.plan_id = p.id
    WHERE v.created_at > ${since} AND v.used = 0
  ` as Array<{ code: string; plan: string; duration_seconds: number; download_kbps: number; upload_kbps: number }>;

  return vouchers.map(v => ({
    code: v.code,
    plan: v.plan,
    duration: v.duration_seconds,
    dl: v.download_kbps,
    ul: v.upload_kbps,
  }));
}

export async function getPayments(): Promise<Payment[]> {
  await initDb();
  const sql = getSql();
  return (await sql`SELECT * FROM payments ORDER BY created_at DESC LIMIT 50`) as Payment[];
}

export async function listDiscountCodes(): Promise<DiscountCode[]> {
  await initDb();
  const sql = getSql();
  return (await sql`SELECT * FROM discount_codes ORDER BY created_at DESC`) as DiscountCode[];
}

export async function getDiscountCode(code: string): Promise<DiscountCode | undefined> {
  await initDb();
  const sql = getSql();
  const result = await sql`SELECT * FROM discount_codes WHERE code = ${code}`;
  return result[0] as DiscountCode | undefined;
}

export async function createDiscountCode(input: {
  code?: string;
  type: DiscountCode['type'];
  value: number;
  plan_id?: string | null;
  max_uses?: number;
  expires_at?: number | null;
}): Promise<DiscountCode> {
  await initDb();
  const sql = getSql();

  if (input.type === 'percent' && (input.value < 1 || input.value > 100)) {
    throw new Error('Percent discount must be between 1 and 100');
  }
  if (input.type === 'fixed' && input.value < 1) {
    throw new Error('Fixed discount must be at least 1');
  }

  const code = (input.code || generateDiscountCode()).trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) {
    throw new Error('Code must be 4-32 chars: A-Z, 0-9, hyphen');
  }
  const existing = await getDiscountCode(code);
  if (existing) throw new Error('Code already exists');

  const now = Math.floor(Date.now() / 1000);
  const maxUses = input.max_uses && input.max_uses > 0 ? input.max_uses : 1;
  const planId = input.plan_id || null;
  const expiresAt = input.expires_at || null;
  const value = input.type === 'free' ? 0 : input.value;

  await sql`
    INSERT INTO discount_codes (code, type, value, plan_id, max_uses, used_count, active, expires_at, created_at)
    VALUES (${code}, ${input.type}, ${value}, ${planId}, ${maxUses}, 0, 1, ${expiresAt}, ${now})
  `;

  return {
    code,
    type: input.type,
    value,
    plan_id: planId,
    max_uses: maxUses,
    used_count: 0,
    active: 1,
    expires_at: expiresAt,
    created_at: now,
  };
}

export async function deactivateDiscountCode(code: string): Promise<boolean> {
  await initDb();
  const sql = getSql();
  const result = await sql`
    UPDATE discount_codes SET active = 0 WHERE code = ${code} RETURNING code
  `;
  return result.length > 0;
}

export async function validateDiscountCode(code: string, planId: string): Promise<{
  valid: boolean;
  error?: string;
  type?: string;
  value?: number;
  discountAmount?: number;
  finalAmount?: number;
}> {
  await initDb();
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(normalized)) {
    return { valid: false, error: 'Invalid code format' };
  }

  const plan = await getPlan(planId);
  if (!plan) return { valid: false, error: 'Plan not found' };

  const dc = await getDiscountCode(normalized);
  if (!dc) return { valid: false, error: 'Code not found' };
  if (!dc.active) return { valid: false, error: 'Code is disabled' };
  if (dc.used_count >= dc.max_uses) return { valid: false, error: 'Code fully used' };
  const now = Math.floor(Date.now() / 1000);
  if (dc.expires_at !== null && dc.expires_at <= now) return { valid: false, error: 'Code expired' };
  if (dc.plan_id !== null && dc.plan_id !== planId) {
    return { valid: false, error: 'Code not valid for this plan' };
  }

  let discountAmount: number;
  if (dc.type === 'free') {
    discountAmount = plan.price_bdt;
  } else if (dc.type === 'percent') {
    discountAmount = Math.round(plan.price_bdt * dc.value / 100);
  } else {
    discountAmount = Math.min(plan.price_bdt, dc.value);
  }
  const finalAmount = Math.max(0, plan.price_bdt - discountAmount);

  return {
    valid: true,
    type: dc.type,
    value: dc.value,
    discountAmount,
    finalAmount,
  };
}

export async function createFreeVouchers(
  planId: string,
  count: number,
  note?: string
): Promise<Voucher[]> {
  await initDb();
  const sql = getSql();
  const plan = await getPlan(planId);
  if (!plan) throw new Error('Plan not found');
  if (count < 1 || count > 100) throw new Error('Count must be 1-100');

  const now = Math.floor(Date.now() / 1000);
  const created: Voucher[] = [];

  for (let i = 0; i < count; i++) {
    let code = generateVoucherCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await sql`SELECT 1 FROM vouchers WHERE code = ${code}`;
      if (clash.length === 0) break;
      code = generateVoucherCode();
    }

    await sql`
      INSERT INTO vouchers (code, plan_id, duration_seconds, download_kbps, upload_kbps, created_at, source, note)
      VALUES (${code}, ${plan.id}, ${plan.duration_seconds}, ${plan.download_kbps}, ${plan.upload_kbps}, ${now}, 'admin', ${note || null})
    `;

    created.push({
      code,
      plan_id: plan.id,
      duration_seconds: plan.duration_seconds,
      download_kbps: plan.download_kbps,
      upload_kbps: plan.upload_kbps,
      used: 0,
      used_by_mac: null,
      used_at: null,
      created_at: now,
      source: 'admin',
      note: note || null,
    });
  }

  return created;
}

export interface RouterSnapshot {
  kind: string;
  payload: string;
  updated_at: number;
}

export interface RouterCommand {
  id: string;
  action: string;
  code: string | null;
  ip: string | null;
  payload: string | null;
  status: string;
  result: string | null;
  created_at: number;
  claimed_at: number | null;
  completed_at: number | null;
}

export async function upsertRouterSnapshot(
  kind: 'status' | 'clients' | 'active',
  payload: string
): Promise<void> {
  await initDb();
  const sql = getSql();
  const now = Math.floor(Date.now() / 1000);
  await sql`
    INSERT INTO router_snapshots (kind, payload, updated_at)
    VALUES (${kind}, ${payload}, ${now})
    ON CONFLICT (kind) DO UPDATE SET payload = ${payload}, updated_at = ${now}
  `;
}

export async function getRouterSnapshot(kind: string): Promise<RouterSnapshot | undefined> {
  await initDb();
  const sql = getSql();
  const result = await sql`SELECT * FROM router_snapshots WHERE kind = ${kind}`;
  return result[0] as RouterSnapshot | undefined;
}

export async function enqueueRouterCommand(
  action: string,
  params: { code?: string; ip?: string; payload?: string | null }
): Promise<RouterCommand> {
  await initDb();
  const sql = getSql();
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const payload = params.payload ?? null;
  await sql`
    INSERT INTO router_commands (id, action, code, ip, payload, status, created_at)
    VALUES (${id}, ${action}, ${params.code || null}, ${params.ip || null}, ${payload}, 'pending', ${now})
  `;
  return {
    id,
    action,
    code: params.code || null,
    ip: params.ip || null,
    payload,
    status: 'pending',
    result: null,
    created_at: now,
    claimed_at: null,
    completed_at: null,
  };
}

export async function claimRouterCommands(): Promise<RouterCommand[]> {
  await initDb();
  const sql = getSql();
  const now = Math.floor(Date.now() / 1000);
  await sql`
    UPDATE router_commands
    SET status = 'pending', claimed_at = NULL
    WHERE status = 'in_progress'
      AND claimed_at IS NOT NULL
      AND claimed_at < ${now - 60}
  `;
  return (await sql`
    WITH pending AS (
      SELECT id FROM router_commands
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 20
    )
    UPDATE router_commands r
    SET status = 'in_progress', claimed_at = ${now}
    FROM pending p
    WHERE r.id = p.id
    RETURNING r.*
  `) as RouterCommand[];
}

export async function completeRouterCommand(
  id: string,
  success: boolean,
  error?: string
): Promise<void> {
  await initDb();
  const sql = getSql();
  const now = Math.floor(Date.now() / 1000);
  const result = success ? 'ok' : error || 'failed';
  await sql`
    UPDATE router_commands
    SET status = 'done', result = ${result}, completed_at = ${now}
    WHERE id = ${id}
  `;
}

export async function getStats() {
  await initDb();
  const sql = getSql();
  const totalVouchers = (await sql`SELECT COUNT(*) as c FROM vouchers`)[0].c;
  const usedVouchers = (await sql`SELECT COUNT(*) as c FROM vouchers WHERE used = 1`)[0].c;
  const totalPayments = (await sql`SELECT COUNT(*) as c FROM payments WHERE status = 'completed'`)[0].c;
  const totalRevenue = (await sql`SELECT COALESCE(SUM(amount_bdt), 0) as s FROM payments WHERE status = 'completed'`)[0].s;

  return {
    totalVouchers: Number(totalVouchers),
    usedVouchers: Number(usedVouchers),
    unusedVouchers: Number(totalVouchers) - Number(usedVouchers),
    totalPayments: Number(totalPayments),
    totalRevenue: Number(totalRevenue),
  };
}