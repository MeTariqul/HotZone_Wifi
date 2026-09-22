import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'data', 'hotspot.db');

function ensureDataDir() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    ensureDataDir();
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initDb(_db);
  }
  return _db;
}

function initDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      download_kbps INTEGER NOT NULL,
      upload_kbps INTEGER NOT NULL,
      price_bdt INTEGER NOT NULL,
      active INTEGER DEFAULT 1
    );

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

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      voucher_code TEXT,
      status TEXT DEFAULT 'pending',
      amount_bdt INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);

  // Seed default plans if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM plans').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare(
      'INSERT INTO plans (id, name, duration_seconds, download_kbps, upload_kbps, price_bdt) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insert.run('trial', 'Trial', 1800, 2048, 1024, 0);
    insert.run('hourly', 'Hourly', 3600, 5120, 1024, 20);
    insert.run('daily', 'Daily', 86400, 10240, 2048, 50);
    insert.run('weekly', 'Weekly', 604800, 5120, 2048, 200);
    insert.run('monthly', 'Monthly', 2592000, 10240, 2048, 500);
  }
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

export function getPlans(): Plan[] {
  return getDb().prepare('SELECT * FROM plans WHERE active = 1').all() as Plan[];
}

export function getPlan(id: string): Plan | undefined {
  return getDb().prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
}

export function createPayment(planId: string): Payment {
  const plan = getPlan(planId);
  if (!plan) throw new Error('Plan not found');
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(
    'INSERT INTO payments (id, plan_id, amount_bdt, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, planId, plan.price_bdt, now);
  return { id, plan_id: planId, voucher_code: null, status: 'pending', amount_bdt: plan.price_bdt, created_at: now, completed_at: null };
}

export function completePayment(paymentId: string): { payment: Payment; voucher: Voucher } {
  const db = getDb();
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as Payment | undefined;
  if (!payment) throw new Error('Payment not found');

  const plan = getPlan(payment.plan_id);
  if (!plan) throw new Error('Plan not found');

  const code = generateVoucherCode();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    'INSERT INTO vouchers (code, plan_id, duration_seconds, download_kbps, upload_kbps, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(code, plan.id, plan.duration_seconds, plan.download_kbps, plan.upload_kbps, now);

  db.prepare(
    'UPDATE payments SET status = ?, voucher_code = ?, completed_at = ? WHERE id = ?'
  ).run('completed', code, now, paymentId);

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

export function getVouchers(): Voucher[] {
  return getDb().prepare('SELECT * FROM vouchers ORDER BY created_at DESC').all() as Voucher[];
}

export function getVoucher(code: string): Voucher | undefined {
  return getDb().prepare('SELECT * FROM vouchers WHERE code = ?').get(code) as Voucher | undefined;
}

export function getNewVouchers(since: number): Array<{ code: string; plan: string; duration: number; dl: number; ul: number }> {
  const vouchers = getDb().prepare(
    `SELECT v.code, p.id as plan, v.duration_seconds, v.download_kbps, v.upload_kbps
     FROM vouchers v
     JOIN plans p ON v.plan_id = p.id
     WHERE v.created_at > ? AND v.used = 0`
  ).all(since) as Array<{ code: string; plan: string; duration_seconds: number; download_kbps: number; upload_kbps: number }>;

  return vouchers.map(v => ({
    code: v.code,
    plan: v.plan,
    duration: v.duration_seconds,
    dl: v.download_kbps,
    ul: v.upload_kbps,
  }));
}

export function getPayments(): Payment[] {
  return getDb().prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT 50').all() as Payment[];
}

export function getStats() {
  const db = getDb();
  const totalVouchers = (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as { c: number }).c;
  const usedVouchers = (db.prepare('SELECT COUNT(*) as c FROM vouchers WHERE used = 1').get() as { c: number }).c;
  const totalPayments = (db.prepare('SELECT COUNT(*) as c FROM payments WHERE status = ?').get('completed') as { c: number }).c;
  const totalRevenue = (db.prepare('SELECT COALESCE(SUM(amount_bdt), 0) as s FROM payments WHERE status = ?').get('completed') as { s: number }).s;

  return {
    totalVouchers,
    usedVouchers,
    unusedVouchers: totalVouchers - usedVouchers,
    totalPayments,
    totalRevenue,
  };
}
