'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/events', label: 'イベント' },
  { href: '/calculator', label: 'ゲートキーパー' },
  { href: '/log', label: 'トレードログ' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-[#1e1e30] bg-[#0f0f1a]">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-12">
        <span className="mono text-xs font-semibold tracking-widest text-[#3b82f6] uppercase">
          EVENT TRADE MGR
        </span>
        <div className="flex gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                pathname === l.href
                  ? 'bg-[#1e1e30] text-[#e2e8f0]'
                  : 'text-[#6b7280] hover:text-[#e2e8f0]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
