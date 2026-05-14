import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/market/dataService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cik = request.nextUrl.searchParams.get('cik') ?? '0000320193';
    const data = await DataService.getSecFilings(cik);
    return NextResponse.json({
      cik,
      source: 'SEC EDGAR',
      isRealtime: false,
      isDelayed: true,
      delaySeconds: 3600,
      updatedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 400 },
    );
  }
}
