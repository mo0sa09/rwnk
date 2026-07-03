'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ReactNode, useState } from 'react'
import { C } from '@/lib/theme'

interface NavbarProps { rightContent?: ReactNode }

const NAV_LINKS = [
  { label: 'الرئيسية',       href: '/'          },
  { label: 'المميزات',       href: '/#features'  },
  { label: 'الخطوات',        href: '/#steps'     },
  { label: 'الاعتراضات',    href: '/#faq'       },
  { label: 'مقارنة بالسوق', href: '/#compare'   },
]

export default function Navbar({ rightContent }: NavbarProps) {
  const [hov, setHov] = useState<string | null>(null)

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 100,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 36px', fontFamily: "'Th','Noto Kufi Arabic',serif",
      direction: 'rtl',
    }}>

      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
        <Image src="/logo-icon.png" alt="رَوْنَق" width={28} height={28} style={{ objectFit: 'contain' }} />
        <span style={{ fontSize: 17, fontWeight: 900, color: C.text1, letterSpacing: -0.3 }}>رَوْنَق</span>
      </Link>

      {/* Center links */}
      {!rightContent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href}
              onMouseEnter={() => setHov(link.href)}
              onMouseLeave={() => setHov(null)}
              style={{
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
                padding: '6px 12px', borderRadius: 8,
                color: hov === link.href ? C.primary : C.text2,
                background: hov === link.href ? C.primaryLight : 'transparent',
                transition: 'all .18s',
              }}>
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {rightContent ?? (
          <>
            <Link href="/login" style={{
              fontSize: 12, color: C.text3, padding: '6px 12px', borderRadius: 7,
              textDecoration: 'none', border: `1px solid ${C.border}`, transition: 'all .18s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.primary; (e.currentTarget as HTMLElement).style.borderColor = C.border2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.text3; (e.currentTarget as HTMLElement).style.borderColor = C.border }}>
              دخول العملاء
            </Link>
            <Link href="/checkout" style={{
              background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700,
              padding: '8px 18px', borderRadius: 9, textDecoration: 'none',
              boxShadow: '0 2px 10px rgba(103,71,178,.28)', transition: 'background .2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.primaryDark }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.primary }}>
              اشترِ الآن
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
