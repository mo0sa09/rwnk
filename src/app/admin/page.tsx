'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { C } from '@/lib/theme'
import {
  IconLayoutDashboard, IconChartBar, IconReceipt, IconCreditCard,
  IconUsers, IconBox, IconWorld, IconUserCog,
} from '@tabler/icons-react'
import { signOut } from '@/lib/auth'
import { ToastProvider, ConfirmProvider } from '@/components/admin/adminUi'
import { DashboardHome } from '@/components/admin/DashboardHome'
import { AnalyticsTab } from '@/components/admin/AnalyticsTab'
import { OrdersTab } from '@/components/admin/OrdersTab'
import { PaymentsTab } from '@/components/admin/PaymentsTab'
import { CustomersTab } from '@/components/admin/CustomersTab'
import { ProductTab } from '@/components/admin/ProductTab'
import { WebsiteSettingsTab } from '@/components/admin/WebsiteSettingsTab'
import { AccountSettingsTab } from '@/components/admin/AccountSettingsTab'

type Tab = 'dashboard' | 'analytics' | 'orders' | 'payments' | 'customers' | 'product' | 'website' | 'account'

const NAV: { id: Tab; label: string; icon: typeof IconLayoutDashboard }[] = [
  { id: 'dashboard', label: 'لوحة التحكم',      icon: IconLayoutDashboard },
  { id: 'analytics', label: 'التحليلات',        icon: IconChartBar },
  { id: 'orders',    label: 'الطلبات',          icon: IconReceipt },
  { id: 'payments',  label: 'المدفوعات',        icon: IconCreditCard },
  { id: 'customers', label: 'العملاء',          icon: IconUsers },
  { id: 'product',   label: 'إدارة المنتج',     icon: IconBox },
  { id: 'website',   label: 'إعدادات الموقع',   icon: IconWorld },
  { id: 'account',   label: 'إعدادات الحساب',   icon: IconUserCog },
]

const SIDEBAR_W = 220
const FONT = "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif"

function AdminShell() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="admin-shell" style={{ display: 'flex', minHeight: '100vh', background: '#F8F7FF', direction: 'rtl', fontFamily: FONT }}>

      {/* ══ SIDEBAR ══ */}
      <aside className="admin-sidebar" style={{ width: SIDEBAR_W, flexShrink: 0, background: '#fff', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50 }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/logo-icon.png" alt="رَوْنَق" width={28} height={33} style={{ width: 28, height: 33, objectFit: 'contain', flexShrink: 0 }} />
            <div><div style={{ fontSize: 15, fontWeight: 900, color: C.text1 }}>رَوْنَق</div><div style={{ fontSize: 10, color: C.text3 }}>لوحة التحكم</div></div>
          </div>
        </div>

        <nav className="admin-nav" style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const Icon = item.icon
            return (
              <button key={item.id} className="admin-nav-btn" onClick={() => setTab(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                background: tab === item.id ? C.primary : 'transparent',
                color: tab === item.id ? '#fff' : C.text2,
                fontSize: 13, fontWeight: tab === item.id ? 700 : 400,
                border: 'none', cursor: 'pointer', textAlign: 'right',
                fontFamily: FONT, transition: 'all .15s',
              }}>
                <span style={{ display: 'flex' }}><Icon size={16} /></span>
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.primary},#8b6dd4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0 }}>م</div>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>المشرف</div><div style={{ fontSize: 10, color: C.text3 }}>admin</div></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Link href="/" style={{ fontSize: 11, color: C.text3, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, textDecoration: 'none' }}>الموقع</Link>
            <button onClick={async () => { await signOut(); window.location.href = '/' }} style={{ fontSize: 11, color: '#E24B4A', padding: '5px 10px', borderRadius: 7, border: '1px solid #FECACA', background: 'none', cursor: 'pointer', fontFamily: FONT }}>خروج</button>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main className="admin-main" style={{ flex: 1, marginRight: SIDEBAR_W, padding: '28px 24px 48px', minWidth: 0 }}>
        {tab === 'dashboard' && <DashboardHome onNavigate={t => setTab(t as Tab)} />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'customers' && <CustomersTab />}
        {tab === 'product' && <ProductTab />}
        {tab === 'website' && <WebsiteSettingsTab />}
        {tab === 'account' && <AccountSettingsTab />}
      </main>
    </div>
  )
}

export default function AdminPage() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AdminShell />
      </ConfirmProvider>
    </ToastProvider>
  )
}
