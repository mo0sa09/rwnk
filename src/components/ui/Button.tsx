'use client'
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export default function Button({
  children, variant = 'primary', size = 'md',
  loading = false, fullWidth = false,
  className = '', disabled, ...props
}: ButtonProps) {
  const base = 'relative font-black rounded-xl overflow-hidden transition-all duration-200 cursor-pointer flex items-center justify-center gap-2'

  const variants = {
    primary:   'text-white',
    secondary: 'bg-white border text-sm font-bold',
    ghost:     'bg-transparent border-none text-sm',
    danger:    'text-white',
  }

  const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-12 px-5 text-sm',
    lg: 'h-14 px-8 text-base',
  }

  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: '#6747B2', boxShadow: '0 2px 12px rgba(103,71,178,.28)' },
    secondary: { borderColor: '#EDE8F5', color: '#4A4060' },
    ghost:     { color: '#4A4060' },
    danger:    { background: '#A32D2D' },
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={styles[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  )
}
