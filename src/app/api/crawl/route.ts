import { NextRequest, NextResponse } from 'next/server'
import { fetchTdnetDisclosures } from '@/lib/tdnet'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? undefined

  try {
    const result = await fetchTdnetDisclosures(date)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ items: [], fetchedDate: date ?? '', error: message }, { status: 500 })
  }
}
