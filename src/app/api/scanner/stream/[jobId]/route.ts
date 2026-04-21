import { NextRequest, NextResponse } from 'next/server'
import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url'
import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const apiKey = await getShopOracleApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Store is not provisioned for scanner access yet.' },
      { status: 503 }
    )
  }

  const upstream = await fetch(
    `${await getOracleGatewayBaseUrl()}/scan/stream/${jobId}`,
    {
      headers: {
        'X-API-Key': apiKey,
        Accept: 'text/event-stream',
      },
    }
  )

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: 'Failed to connect to scanner stream' },
      { status: upstream.status }
    )
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Allow the browser to read the stream cross-origin from localhost in dev
      'Access-Control-Allow-Origin': '*',
    },
  })
}
