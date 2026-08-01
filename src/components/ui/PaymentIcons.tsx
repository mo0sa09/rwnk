// Payment method marks for the checkout payment selector. Visa/Mastercard
// and Apple Pay are self-contained inline SVG (vector — sharp at any
// resolution/DPR by construction, no raster asset needed). KNET is the one
// mark sourced from an actual reference image (see KnetIcon below) since
// its real mark is a specific illustrated badge, not a typeface wordmark
// that can be faithfully reproduced with SVG <text>.
import Image from 'next/image'

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

// KNET's official mark is a square badge (blue field, "كي نت" Arabic
// wordmark, yellow "K" glyph, "NET" wordmark) — not a wide card like its
// siblings, so it is rendered at its own NATIVE 1:1 aspect ratio rather than
// stretched into the same wide-pill shape as Visa/Mastercard/Apple Pay.
// Only its HEIGHT matches the sibling icons (the shared contract every
// caller already relies on); width follows naturally from the square
// source, so nothing is distorted. Source is a 256×256 static asset —
// 6–12× the ~20–40px on-screen size this renders at — specifically so it
// stays crisp at 2x/3x device pixel ratios; next/image additionally emits a
// responsive srcset and serves WebP/AVIF where supported.
export function KnetIcon({ height = 22 }: { height?: number }) {
  return (
    <Image
      src="/payment-icons/knet.jpg"
      alt="KNET"
      width={256}
      height={256}
      style={{
        width: height, height, flexShrink: 0, display: 'block',
        // 6/40 matches the corner-radius-to-height ratio used by the
        // sibling cards' rx="6" on a 40-tall viewBox, so all three payment
        // icons read as the same family of rounded badge shapes.
        borderRadius: Math.round(height * 0.15), border: '1px solid #EDE8F5',
        objectFit: 'cover',
      }}
    />
  )
}

// Apple's official bitten-apple glyph (correct orientation: leaf tilting up
// toward the right, bite notch on the right side of the fruit) followed by
// the "Pay" wordmark — replaces a previous hand-approximated path whose
// silhouette was subtly malformed/mirrored. Composition (black pill,
// left-aligned glyph, "Pay" following) is unchanged from before; only the
// glyph itself and its proportions relative to "Pay" were corrected to
// match Apple's actual Apple Pay mark.
export function ApplePayIcon({ height = 22 }: { height?: number }) {
  return (
    <svg width={height * 2.15} height={height} viewBox="0 0 86 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4" width="86" height="32" rx="6" fill="#000" />
      <g transform="translate(15,7) scale(0.72)" fill="#fff">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47c-1.34.03-1.77-.79-3.29-.79c-1.53 0-2 .77-3.27.82c-1.31.05-2.3-1.32-3.14-2.53C4.25 17.11 2.94 12.65 4.7 9.62c.87-1.51 2.43-2.44 4.13-2.46c1.29-.02 2.5.87 3.29.87c.78 0 2.26-1.08 3.81-.92c.65.03 2.47.26 3.64 1.98c-.09.06-2.17 1.28-2.15 3.81c.03 3.02 2.65 4.03 2.68 4.04c-.03.07-.42 1.44-1.38 2.85M13 3.5c.73-.83 1.94-1.46 2.94-1.5c.13 1.17-.34 2.35-1.04 3.19c-.69.85-1.83 1.51-2.95 1.42c-.15-1.15.41-2.35 1.05-3.11" />
      </g>
      <text x="34" y="25.5" fontFamily="-apple-system, 'SF Pro Text', Arial, sans-serif" fontWeight="600" fontSize="14" fill="#fff">Pay</text>
    </svg>
  )
}
