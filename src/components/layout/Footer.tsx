'use client'
import Link from 'next/link'
import Image from 'next/image'
import { C } from '@/lib/theme'
import { DEFAULT_SETTINGS, type StoreSettings } from '@/lib/store-settings'
import {
  IconBrandInstagram, IconBrandTwitter, IconBrandWhatsapp,
  IconShieldCheck, IconBolt, IconStarFilled,
} from '@tabler/icons-react'

function buildLinks(S: StoreSettings) {
  return {
    'المنتج': [
      { label: 'المميزات',         href: '/#features'  },
      { label: 'المحتوى',          href: '/#content'   },
      { label: 'التسعير',          href: '/#pricing'   },
      { label: 'الضمان',           href: '/#guarantee' },
      { label: 'الأسئلة الشائعة', href: '/#faq'       },
    ],
    'حسابي': [
      { label: 'شراء الكتاب',      href: '/checkout'  },
      { label: 'دخول العملاء',     href: '/login'     },
      { label: 'إنشاء حساب',       href: '/register'  },
      { label: 'مكتبتي',           href: '/library'   },
    ],
    'الدعم': [
      { label: 'تواصل معنا',       href: `mailto:${S.email}` },
      { label: 'واتساب',           href: `https://wa.me/${S.whatsapp.replace(/\D/g,'')}` },
      { label: 'من نحن',           href: '/about'   },
      { label: 'الأسئلة الشائعة', href: '/faq'     },
      { label: 'سياسة الخصوصية',  href: '/privacy' },
      { label: 'شروط الاستخدام',  href: '/terms'   },
      { label: 'سياسة الاسترجاع', href: '/refund'  },
    ],
  }
}

function buildSocial(S: StoreSettings) {
  return [
    { icon: IconBrandInstagram, href: `https://instagram.com/${S.instagram.replace('@','')}`, label: 'انستغرام' },
    { icon: IconBrandTwitter,   href: `https://twitter.com/${S.twitter.replace('@','')}`,    label: 'تويتر'    },
    { icon: IconBrandWhatsapp,  href: `https://wa.me/${S.whatsapp.replace(/\D/g,'')}`,      label: 'واتساب'   },
  ]
}

const TRUST = [
  { icon: IconStarFilled,   text: '4.9 متوسط التقييم'      },
  { icon: IconShieldCheck,  text: 'ضمان الاسترجاع 7 أيام'  },
  { icon: IconBolt,         text: 'تحميل فوري بعد الدفع'   },
]

export default function Footer({ settings }: { settings?: StoreSettings }) {
  const S = settings ?? DEFAULT_SETTINGS
  const LINKS = buildLinks(S)
  const SOCIAL = buildSocial(S)

  return (
    <footer style={{ background: C.text1, color: '#fff', fontFamily: "'Th','Noto Kufi Arabic',serif", direction: 'rtl' }}>

      {/* CTA Banner */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: 'clamp(32px,7vw,52px) clamp(20px,6vw,40px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, marginBottom: 6 }}>{S.footer_cta_title}</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>{S.footer_cta_subtitle}</p>
          </div>
          <Link href="/checkout" style={{
            background: C.primary, color: '#fff', fontSize: 14, fontWeight: 900,
            padding: '14px 28px', borderRadius: 12, display: 'inline-block',
            boxShadow: '0 4px 20px rgba(103,71,178,.5)', flexShrink: 0, textDecoration: 'none',
          }}>
            اشترِ الآن — {S.product_price} د.ك
          </Link>
        </div>
      </div>

      {/* Links grid */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: 'clamp(32px,7vw,48px) clamp(20px,6vw,40px)' }}>
        <div className="grid-4" style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40 }}>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Image src="/logo-icon.png" alt={S.store_name} width={26} height={26} style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 17, fontWeight: 900 }}>{S.store_name}</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, maxWidth: 210, marginBottom: 22 }}>
              {S.store_tagline} — الدليل الأول للتنظيف المنزلي بمعايير الفنادق الراقية.
            </p>

            {/* Social icons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {SOCIAL.map(({ icon: Icon, href, label }) => (
                <Link key={label} href={href} title={label} aria-label={label} style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)', transition: 'all .2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)' }}
                >
                  <Icon size={16} />
                </Link>
              ))}
            </div>

            {/* Trust */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TRUST.map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  <Icon size={13} color="rgba(255,255,255,0.3)" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
                {title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {links.map(link => (
                  <Link key={link.href} href={link.href} style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color .18s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ padding: '18px clamp(20px,6vw,40px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} {S.store_name} — جميع الحقوق محفوظة
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['KW', 'SA', 'AE', 'BH'].map(c => (
              <span key={c} style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 5 }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

    </footer>
  )
}
