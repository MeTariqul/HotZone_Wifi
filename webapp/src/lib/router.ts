const ROUTER_URL = process.env.ROUTER_URL || '';
const ROUTER_SECRET = process.env.ROUTER_SECRET || '';

interface RouterResponse {
  success: boolean;
  [key: string]: unknown;
}

function buildUrl(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${ROUTER_URL}${path}${sep}secret=${encodeURIComponent(ROUTER_SECRET)}`;
}

async function callRouter(path: string, method = 'GET', body?: unknown): Promise<RouterResponse> {
  if (!ROUTER_URL) {
    return { success: false, error: 'ROUTER_URL not configured' };
  }

  try {
    const res = await fetch(buildUrl(path), {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });
    return await res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Router unreachable';
    return { success: false, error: msg };
  }
}

export function getRouterStatus() {
  return callRouter('/cgi-bin/hotspot?status');
}

export function getRouterClients() {
  return callRouter('/cgi-bin/hotspot?clients');
}

export function getActiveVouchers() {
  return callRouter('/cgi-bin/hotspot?active');
}

export function kickVoucher(code: string) {
  return callRouter(`/cgi-bin/hotspot?kick=${encodeURIComponent(code)}`);
}

export function blockClient(ip: string) {
  return callRouter(`/cgi-bin/hotspot?block=${encodeURIComponent(ip)}`);
}

export function unblockClient(ip: string) {
  return callRouter(`/cgi-bin/hotspot?unblock=${encodeURIComponent(ip)}`);
}

export function authorizeClient(data: {
  code: string;
  mac: string;
  ip: string;
  duration: number;
  download: number;
  upload: number;
}) {
  return callRouter('/cgi-bin/hotspot?authorize', 'POST', data);
}

export function updateQoS(ip: string, download: number, upload: number) {
  return callRouter('/cgi-bin/hotspot?qos', 'POST', { ip, download, upload });
}
