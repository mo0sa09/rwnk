'use client'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="mb-3">
        {label && (
          <label className="block text-xs font-bold mb-1.5 tracking-wide uppercase"
            style={{ color: '#4A4060' }}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`rwnq-input ${icon ? 'pr-11' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
              style={{ color: '#C8C0D8' }}>
              {icon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs" style={{ color: '#A32D2D' }}>{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
export default Input
