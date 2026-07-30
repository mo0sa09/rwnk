'use client'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { C } from '@/lib/theme'

export const W = '#fff'
export const BG = '#F8F7FF'

export const inp: React.CSSProperties = {
  width: '100%', height: 44, background: '#fafafa', border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '0 12px', fontSize: 13, color: C.text1, outline: 'none',
  fontFamily: "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif", transition: 'all .2s',
}
export const label: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: C.text2,
  textTransform: 'uppercase', marginBottom: 5,
}
export const card: React.CSSProperties = {
  background: W, border: `1px solid ${C.border}`, borderRadius: 18, padding: '22px 24px',
}
export const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 900, color: C.text1, marginBottom: 16 }

export const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = C.primary; e.target.style.boxShadow = '0 0 0 3px rgba(103,71,178,.1)'
}
export const blur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: C.text1, marginBottom: 4 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: C.text3 }}>{subtitle}</p>}
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '32px 16px', color: C.text3, fontSize: 13 }}>{text}</div>
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${C.border}`, borderTopColor: C.primary,
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

export function LoadingBlock({ text = 'جاري التحميل...' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '32px 16px', color: C.text3, fontSize: 13 }}>
      <Spinner /> {text}
    </div>
  )
}

export const btnPrimary = (busy: boolean): React.CSSProperties => ({
  height: 46, padding: '0 28px', background: busy ? '#8b6dd4' : C.primary, color: W,
  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 900,
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif",
  boxShadow: '0 2px 12px rgba(103,71,178,.28)',
})

// ── Toast notifications ─────────────────────────────────────
interface ToastItem { id: number; kind: 'success' | 'error'; text: string }
interface ToastCtx { push: (kind: 'success' | 'error', text: string) => void }
const ToastContext = createContext<ToastCtx>({ push: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const push = useCallback((kind: 'success' | 'error', text: string) => {
    const id = ++idRef.current
    setItems(list => [...list, { id, kind, text }])
    setTimeout(() => setItems(list => list.filter(t => t.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'calc(100vw - 32px)' }}>
        {items.map(t => (
          <div key={t.id} role="status" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 12,
            fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.15)',
            background: t.kind === 'success' ? '#085041' : '#A32D2D', color: '#fff',
            fontFamily: "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif",
            animation: 'fadeUp .2s ease',
          }}>
            {t.kind === 'success' ? '✓' : '✕'} {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ── Confirm dialog ──────────────────────────────────────────
interface ConfirmState { message: string; onConfirm: () => void }
interface ConfirmCtx { ask: (message: string, onConfirm: () => void) => void }
const ConfirmContext = createContext<ConfirmCtx>({ ask: () => {} })
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)
  const ask = useCallback((message: string, onConfirm: () => void) => setState({ message, onConfirm }), [])
  return (
    <ConfirmContext.Provider value={{ ask }}>
      {children}
      {state && (
        <div role="alertdialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(26,18,40,.45)', zIndex: 1001,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setState(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 18, padding: '24px 26px', maxWidth: 380, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "var(--font-tajawal),'Segoe UI',Tahoma,'Geeza Pro',Arial,sans-serif",
          }}>
            <p style={{ fontSize: 14, color: C.text1, lineHeight: 1.6, marginBottom: 20 }}>{state.message}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { state.onConfirm(); setState(null) }} style={{
                flex: 1, height: 42, background: '#A32D2D', color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
              }}>تأكيد</button>
              <button onClick={() => setState(null)} style={{
                flex: 1, height: 42, background: '#fff', color: C.text2, border: `1px solid ${C.border}`, borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
