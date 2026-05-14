import { NextResponse } from 'next/server';
import { DataService } from '@/lib/market/dataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await DataService.getSourceStatuses();
    return NextResponse.json({ sources: data, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
