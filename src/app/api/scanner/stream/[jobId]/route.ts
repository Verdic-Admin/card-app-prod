import { NextRequest, NextResponse } from 'next/server'
import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const apiKey = process.env.PLAYERINDEX_API_KEY || ''

  const upstream = await fetch(
    `${getOracleGatewayBaseUrl()}/scan/stream/${jobId}`,
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
