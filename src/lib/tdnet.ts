import { parse } from 'node-html-parser'
import { EventType, Direction } from '@/types'

export interface Disclosure {
  time: string
  ticker: string
  companyName: string
  title: string
  docUrl: string
  suggestedEventType: EventType
  suggestedDirection: Direction
}

type MatchRule = {
  keywords: string[]
  eventType: EventType
  direction: Direction
}

const MATCH_RULES: MatchRule[] = [
  {
    keywords: ['公開買付', 'TOB', 'take over bid', '株式公開買付'],
    eventType: 'TOB',
    direction: 'LONG',
  },
  {
    keywords: ['MBO', 'マネジメント・バイアウト', '経営陣による買収', '経営陣が参加する'],
    eventType: 'MBO',
    direction: 'LONG',
  },
  {
    keywords: [
      'TOPIX採用', 'TOPIX構成銘柄への追加', '日経平均株価の算出に用いる銘柄への追加',
      'インデックス採用', 'Russell/Nomura', 'MSCIへの採用',
    ],
    eventType: 'INDEX_IN',
    direction: 'LONG',
  },
  {
    keywords: [
      'TOPIX除外', 'TOPIX構成銘柄からの除外', '日経平均株価の算出に用いる銘柄からの除外',
      'インデックス除外',
    ],
    eventType: 'INDEX_OUT',
    direction: 'SHORT',
  },
  {
    keywords: ['ロックアップ', '大株主による売出', '株式の売出しに関する', '大量売却'],
    eventType: 'IPO_LOCKUP',
    direction: 'SHORT',
  },
  {
    keywords: ['決算短信', '業績予想の修正', '四半期決算'],
    eventType: 'EARNINGS',
    direction: 'LONG',
  },
]

function matchTitle(title: string): { eventType: EventType; direction: Direction } | null {
  for (const rule of MATCH_RULES) {
    if (rule.keywords.some(k => title.includes(k))) {
      return { eventType: rule.eventType, direction: rule.direction }
    }
  }
  return null
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTdnetPage(html: string): Disclosure[] {
  const root = parse(html)
  const items: Disclosure[] = []
  const rows = root.querySelectorAll('tr')

  for (const row of rows) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 4) continue

    const time = cells[0].text.trim()
    const ticker = cells[1].text.trim()
    const companyName = cells[2].text.trim()
    const titleCell = cells[3]
    const title = titleCell.text.trim()
    const linkHref = titleCell.querySelector('a')?.getAttribute('href') ?? ''

    // Ticker: 4–5 digit stock code (include market suffix like 'E' or 'A')
    if (!/^\d{4,5}/.test(ticker.replace(/[^0-9]/g, '').slice(0, 5))) continue
    if (!title) continue

    const match = matchTitle(title)
    if (!match) continue

    const docUrl = linkHref
      ? linkHref.startsWith('http')
        ? linkHref
        : `https://www.release.tdnet.info${linkHref}`
      : ''

    items.push({
      time,
      ticker: ticker.replace(/\s+/g, ''),
      companyName,
      title,
      docUrl,
      suggestedEventType: match.eventType,
      suggestedDirection: match.direction,
    })
  }

  return items
}

export async function fetchTdnetDisclosures(date?: string): Promise<{
  items: Disclosure[]
  fetchedDate: string
  error?: string
}> {
  const today = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const allItems: Disclosure[] = []
  let lastError: string | undefined

  // TDnet paginates: I_list_00_..., I_list_01_..., I_list_02_...
  for (let page = 0; page <= 4; page++) {
    const pageStr = String(page).padStart(2, '0')
    const url = `https://www.release.tdnet.info/inbs/I_list_${pageStr}_${today}.html`

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
          'Accept-Charset': 'utf-8',
        },
        signal: AbortSignal.timeout(12000),
      })

      if (res.status === 404) break
      if (!res.ok) {
        lastError = `HTTP ${res.status}`
        break
      }

      // Handle encoding: try UTF-8 first, fallback to Shift-JIS
      const buffer = await res.arrayBuffer()
      let text: string
      try {
        const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
        text = utf8
      } catch {
        try {
          text = new TextDecoder('shift-jis').decode(buffer)
        } catch {
          text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
        }
      }

      const pageItems = parseTdnetPage(text)
      allItems.push(...pageItems)

      // If fewer than 20 items on a page, it's probably the last page
      if (pageItems.length === 0) break
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      lastError = msg
      break
    }
  }

  return {
    items: allItems,
    fetchedDate: today,
    error: lastError,
  }
}

// Format YYYYMMDD → YYYY-MM-DD for <input type="date">
export function tdnetDateToIso(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}
