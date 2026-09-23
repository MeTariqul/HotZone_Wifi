import { NextResponse } from 'next/server';
import { listAuditLogs } from '@/lib/db';

export async function GET() {
  try {
    const logs = await listAuditLogs();
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: 'Failed to list audit logs' }, { status: 500 });
  }
}
