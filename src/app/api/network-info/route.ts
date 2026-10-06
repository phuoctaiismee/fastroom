import { NextResponse } from 'next/server';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;

    for (const net of netList) {
      // IPv4 and not internal and not link-local (169.254.x.x)
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        addresses.push(net.address);
      }
    }
  }

  // Sort addresses to prioritize 192.168.x.x (standard Wi-Fi LAN)
  addresses.sort((a, b) => {
    if (a.startsWith('192.168.')) return -1;
    if (b.startsWith('192.168.')) return 1;
    if (a.startsWith('10.')) return -1;
    if (b.startsWith('10.')) return 1;
    return 0;
  });

  return NextResponse.json({
    ipAddresses: addresses,
    primaryIp: addresses[0] || 'localhost',
  });
}
