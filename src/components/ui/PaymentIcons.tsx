// Inline, self-contained payment method marks — no external asset requests.
// Purely visual trust signals for the checkout payment selector.

export function CardBrandsIcon({ height = 22 }: { height?: number }) {
  return (
    <svg width={height * 2.15} height={height} viewBox="0 0 86 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Visa */}
      <rect x="0" y="4" width="40" height="32" rx="6" fill="#fff" stroke="#EDE8F5" />
      <text x="20" y="25" textAnchor="middle" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="900" fontSize="13" fill="#1A1F71">VISA</text>
      {/* Mastercard */}
      <rect x="46" y="4" width="40" height="32" rx="6" fill="#fff" stroke="#EDE8F5" />
      <circle cx="63" cy="20" r="9" fill="#EB001B" />
      <circle cx="73" cy="20" r="9" fill="#F79E1B" fillOpacity="0.92" />
    </svg>
  )
}

export function KnetIcon({ height = 22 }: { height?: number }) {
  return (
    <svg width={height * 2.15} height={height} viewBox="0 0 86 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="86" height="32" rx="6" fill="#fff" stroke="#EDE8F5" />
      <text x="43" y="25" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" letterSpacing="0.5">
        <tspan fill="#00558C">K</tspan><tspan fill="#00558C">N</tspan><tspan fill="#ED1C24">E</tspan><tspan fill="#00558C">T</tspan>
      </text>
    </svg>
  )
}

export function ApplePayIcon({ height = 22 }: { height?: number }) {
  return (
    <svg width={height * 2.15} height={height} viewBox="0 0 86 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="86" height="32" rx="6" fill="#000" />
      <g transform="translate(16,11)" fill="#fff">
        <path d="M9.4 2.5c.55-.67.93-1.6.83-2.5-.8.03-1.77.53-2.34 1.2-.5.58-.95 1.54-.83 2.44.9.07 1.8-.46 2.34-1.14Z" />
        <path d="M10.22 3.87c-1.29-.08-2.38.73-2.99.73-.62 0-1.55-.7-2.56-.68-1.32.02-2.54.77-3.21 1.95-1.38 2.38-.36 5.9.98 7.84.65.95 1.43 2 2.46 1.96 1-.04 1.37-.64 2.57-.64 1.2 0 1.53.64 2.57.62 1.06-.02 1.73-.96 2.38-1.92.75-1.1 1.06-2.17 1.08-2.22-.02-.02-2.07-.8-2.09-3.16-.02-1.97 1.61-2.91 1.68-2.96-.92-1.36-2.36-1.51-2.87-1.52Z" />
      </g>
      <text x="34" y="25" fontFamily="-apple-system, Arial, sans-serif" fontWeight="600" fontSize="14" fill="#fff">Pay</text>
    </svg>
  )
}
