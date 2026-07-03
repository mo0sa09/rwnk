// ═══════════════════════════════════════════════
// رَوْنَق — Central Theme & Design System
// All colors/fonts/spacing in one place
// Admin can override via store_settings table
// ═══════════════════════════════════════════════

export const defaultTheme = {
  colors: {
    primary:    '#6747B2',
    primaryDark:'#4a2fa0',
    primaryLight:'#EDE8FF',
    primaryText: '#26215C',
    secondary:  '#36DB9C',
    secondaryBg:'#E1F5EE',
    highlight:  '#FCB932',
    highlightBg:'#FAEEDA',
    bg:         '#FFFFFF',
    surface:    '#FAFAFA',
    border:     '#EDE8F5',
    border2:    '#DDD6F0',
    text1:      '#1A1228',
    text2:      '#4A4060',
    text3:      '#9890AA',
    text4:      '#C8C0D8',
    error:      '#E24B4A',
    errorBg:    '#FEF2F2',
    success:    '#36DB9C',
    successBg:  '#E1F5EE',
  },
  font:     "'Th','Noto Kufi Arabic',serif",
  radius: {
    sm:   '8px',
    md:   '12px',
    lg:   '16px',
    xl:   '20px',
    xl2:  '24px',
    full: '999px',
  },
  shadow: {
    card:  '0 1px 2px rgba(103,71,178,.04), 0 4px 16px rgba(103,71,178,.06), 0 16px 48px rgba(103,71,178,.07)',
    btn:   '0 2px 12px rgba(103,71,178,.28)',
    btnHover: '0 6px 24px rgba(103,71,178,.38)',
    float: '0 8px 32px rgba(103,71,178,.12)',
  },
}

export type Theme = typeof defaultTheme

// CSS vars string for injection
export function themeToCssVars(t: typeof defaultTheme['colors']): string {
  return `
    --p:${t.primary};--pd:${t.primaryDark};--pl:${t.primaryLight};--pt:${t.primaryText};
    --s:${t.secondary};--sb:${t.secondaryBg};
    --h:${t.highlight};--hb:${t.highlightBg};
    --bg:${t.bg};--sf:${t.surface};
    --br:${t.border};--br2:${t.border2};
    --t1:${t.text1};--t2:${t.text2};--t3:${t.text3};--t4:${t.text4};
    --err:${t.error};--errb:${t.errorBg};
  `
}

export const C = defaultTheme.colors
export const R = defaultTheme.radius
export const SH = defaultTheme.shadow
