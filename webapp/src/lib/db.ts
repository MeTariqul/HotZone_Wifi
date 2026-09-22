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
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `;

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
}

export interface Payment {
  id: string;
  plan_id: string;
  voucher_code: string | null;
  status: string;
  amount_bdt: number;
  created_at: number;
  completed_at: number | null;
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

export async function createPayment(planId: string): Promise<Payment> {
  await initDb();
  const sql = getSql();
  const plan = await getPlan(planId);
  if (!plan) throw new Error('Plan not found');
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  await sql`
    INSERT INTO payments (id, plan_id, amount_bdt, created_at)
    VALUES (${id}, ${planId}, ${plan.price_bdt}, ${now})
  `;
  return { id, plan_id: planId, voucher_code: null, status: 'pending', amount_bdt: plan.price_bdt, created_at: now, completed_at: null };
}

export async function completePayment(paymentId: string): Promise<{ payment: Payment; voucher: Voucher }> {
  await initDb();
  const sql = getSql();
  const paymentResult = await sql`SELECT * FROM payments WHERE id = ${paymentId}`;
  const payment = paymentResult[0] as Payment | undefined;
  if (!payment) throw new Error('Payment not found');

  const plan = await getPlan(payment.plan_id);
  if (!plan) throw new Error('Plan not found');

  const code = generateVoucherCode();
  const now = Math.floor(Date.now() / 1000);

  await sql`
    INSERT INTO vouchers (code, plan_id, duration_seconds, download_kbps, upload_kbps, created_at)
    VALUES (${code}, ${plan.id}, ${plan.duration_seconds}, ${plan.download_kbps}, ${plan.upload_kbps}, ${now})
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