import { NextResponse } from 'next/server';
import { syncInventoryWithOracle } from '@/app/actions/oracleSync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // CRITICAL REMINDER: You must add CRON_SECRET=your_super_secret_string_here 
  // to your .env.local and to your production deployment environment variables.
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('Unauthorized cron execution attempt missing valid CRON_SECRET token.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncInventoryWithOracle();
    return NextResponse.json({ 
      success: true, 
      message: "8 AM Oracle Sync Complete", 
      data: result 
    });
  } catch (error: any) {
    console.error('Oracle Sync Cron failed:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
