// Built-in placeholder hero illustration — used on the landing page whenever
// no admin-uploaded hero image exists (Admin ▸ Website Settings ▸ Homepage ▸
// صورة الهيرو). Pure inline SVG so it's crisp at every size, has zero network
// cost, and never causes CLS (the wrapper below fixes a 4:3 box before the
// SVG paints). Depicts a modern iPad displaying the رَوْنَق guide, staged in
// a soft neutral studio environment — deliberately not a stock photo.
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 600"
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label="عرض توضيحي لدليل رَوْنَق على جهاز لوحي"
    >
      <defs>
        <radialGradient id="hi-blob1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EDE8FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#EDE8FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hi-blob2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FCB932" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FCB932" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hi-blob3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#36DB9C" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#36DB9C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hi-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3A3350" />
          <stop offset="55%" stopColor="#251E38" />
          <stop offset="100%" stopColor="#181025" />
        </linearGradient>
        <linearGradient id="hi-bodyEdge" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5A4E78" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#5A4E78" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hi-cover" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C5FD1" />
          <stop offset="100%" stopColor="#5536A0" />
        </linearGradient>
        <radialGradient id="hi-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#26215C" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#26215C" stopOpacity="0" />
        </radialGradient>
        <filter id="hi-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="hi-cardShadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#26215C" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* staged neutral environment */}
      <rect x="0" y="0" width="800" height="600" fill="#FAFAFA" />
      <circle cx="180" cy="140" r="220" fill="url(#hi-blob1)" />
      <circle cx="640" cy="480" r="180" fill="url(#hi-blob2)" />
      <circle cx="620" cy="120" r="130" fill="url(#hi-blob3)" />

      {/* ground shadow */}
      <ellipse cx="400" cy="548" rx="200" ry="26" fill="url(#hi-shadow)" filter="url(#hi-soft)" />

      {/* iPad body */}
      <g filter="url(#hi-cardShadow)">
        <rect x="220" y="66" width="360" height="470" rx="38" fill="url(#hi-body)" />
        <rect x="220" y="66" width="360" height="470" rx="38" fill="none" stroke="url(#hi-bodyEdge)" strokeWidth="1.5" />
        <circle cx="400" cy="90" r="3.5" fill="#4A4060" />

        {/* screen */}
        <rect x="242" y="112" width="316" height="386" rx="16" fill="#ffffff" />

        {/* screen: top wordmark row */}
        <rect x="264" y="134" width="26" height="26" rx="8" fill="#6747B2" />
        <rect x="298" y="140" width="70" height="7" rx="3.5" fill="#DDD6F0" />
        <rect x="298" y="152" width="44" height="6" rx="3" fill="#EDE8F5" />

        {/* screen: cover art block */}
        <rect x="264" y="176" width="272" height="168" rx="14" fill="url(#hi-cover)" />
        <circle cx="400" cy="248" r="34" fill="#ffffff" fillOpacity="0.14" />
        <circle cx="400" cy="248" r="34" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
        <path d="M388 248 l8 8 l16 -18" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="286" y="304" width="228" height="6" rx="3" fill="#ffffff" fillOpacity="0.5" />
        <rect x="286" y="318" width="150" height="6" rx="3" fill="#ffffff" fillOpacity="0.32" />

        {/* screen: skeleton text lines */}
        <rect x="264" y="364" width="272" height="7" rx="3.5" fill="#EDE8F5" />
        <rect x="264" y="380" width="240" height="7" rx="3.5" fill="#EDE8F5" />
        <rect x="264" y="396" width="256" height="7" rx="3.5" fill="#EDE8F5" />
        <rect x="264" y="412" width="180" height="7" rx="3.5" fill="#EDE8F5" />

        {/* screen: bottom cta pill */}
        <rect x="264" y="446" width="272" height="34" rx="17" fill="#EDE8FF" />
        <rect x="352" y="459" width="96" height="8" rx="4" fill="#6747B2" />
      </g>

      {/* floating decorative card — checkmark / "instant delivery" */}
      <g filter="url(#hi-cardShadow)" transform="rotate(-6 168 240)">
        <rect x="118" y="200" width="100" height="80" rx="18" fill="#ffffff" />
        <circle cx="168" cy="232" r="18" fill="#E1F5EE" />
        <path d="M160 232 l6 6 l12 -13" fill="none" stroke="#149E6E" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="140" y="258" width="56" height="6" rx="3" fill="#EDE8F5" />
      </g>

      {/* floating decorative card — rating / premium */}
      <g filter="url(#hi-cardShadow)" transform="rotate(8 636 200)">
        <rect x="590" y="162" width="92" height="76" rx="18" fill="#ffffff" />
        <path d="M636 182 l6.5 13.2 14.6 2.1 -10.6 10.3 2.5 14.5 -13 -6.8 -13 6.8 2.5 -14.5 -10.6 -10.3 14.6 -2.1 z" fill="#FCB932" />
      </g>

      {/* floating decorative dot cluster */}
      <g opacity="0.9">
        <circle cx="590" cy="420" r="7" fill="#36DB9C" />
        <circle cx="612" cy="440" r="4.5" fill="#6747B2" fillOpacity="0.5" />
        <circle cx="204" cy="420" r="5.5" fill="#FCB932" />
        <circle cx="180" cy="392" r="4" fill="#6747B2" fillOpacity="0.4" />
      </g>
    </svg>
  )
}
