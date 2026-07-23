'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ReactNode, useEffect, useState } from 'react'
import { C } from '@/lib/theme'
import { IconMenu2, IconX } from '@tabler/icons-react'

interface NavbarProps { rightContent?: ReactNode }

const NAV_LINKS = [
  { label: 'الرئيسية',       href: '/'          },
  { label: 'المميزات',       href: '/#features'  },
  { label: 'الخطوات',        href: '/#steps'     },
  { label: 'الأسئلة الشائعة', href: '/#faq'     },
  { label: 'مقارنة بالسوق', href: '/#compare'   },
]

export default function Navbar({ rightContent }: NavbarProps) {
  const [hov, setHov] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // Lock body scroll while the mobile menu is open. Closing on navigation
  // is handled by each link's own onClick — no effect needed for that half.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
    <nav className="navbar-root" style={{
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
        <div className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            <div className="navbar-desktop-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            </div>

            {/* Mobile hamburger — hidden on desktop via .navbar-burger { display:none } default,
                shown below 780px alongside the hidden .navbar-links (see globals.css). */}
            <button
              className="navbar-burger"
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={open}
              style={{
                display: 'none', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: 9,
                background: open ? C.primaryLight : 'transparent',
                border: `1px solid ${open ? C.border2 : C.border}`,
                color: C.text1, cursor: 'pointer',
              }}
            >
              {open ? <IconX size={20} /> : <IconMenu2 size={20} />}
            </button>
          </>
        )}
      </div>
    </nav>

    {/* Mobile menu panel — a sibling of <nav>, not a child. <nav> uses
        backdropFilter, which (like transform) creates a new containing
        block for `position: fixed` descendants; nested inside it, this
        panel's top/bottom offsets resolved against nav's own 60px box
        instead of the viewport and collapsed to 0 height. */}
    {!rightContent && open && (
      <div className="navbar-mobile-panel">
        <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 20px', gap: 4 }}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} style={{
              fontSize: 15, fontWeight: 700, color: C.text1, textDecoration: 'none',
              padding: '13px 14px', borderRadius: 10, borderBottom: `1px solid ${C.border}`,
            }}>
              {link.label}
            </Link>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            <Link href="/login" onClick={() => setOpen(false)} style={{
              textAlign: 'center', fontSize: 14, fontWeight: 700, color: C.text2,
              padding: '13px 14px', borderRadius: 11, border: `1px solid ${C.border}`, textDecoration: 'none',
            }}>
              دخول العملاء
            </Link>
            <Link href="/checkout" onClick={() => setOpen(false)} style={{
              textAlign: 'center', background: C.primary, color: '#fff', fontSize: 14, fontWeight: 900,
              padding: '14px', borderRadius: 11, textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(103,71,178,.28)',
            }}>
              اشترِ الآن
            </Link>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
