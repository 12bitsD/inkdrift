export function EmptyArt({ variant = 'bike' }: { variant?: 'bike' | 'layers' | 'spark' }) {
  if (variant === 'layers') return (
    <svg className="empty-art" viewBox="0 0 240 180" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="m120 35 75 40-75 40-75-40 75-40Z" /><path d="m45 95 75 40 75-40M45 115l75 40 75-40" />
        <path d="m120 55 45 24-45 24-45-24 45-24Z" opacity=".45" />
      </g>
    </svg>
  )
  if (variant === 'spark') return (
    <svg className="empty-art" viewBox="0 0 240 180" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M120 28v36M120 116v36M28 90h36M176 90h36M55 25l25 25M160 130l25 25M185 25l-25 25M80 130l-25 25" />
        <circle cx="120" cy="90" r="24" /><circle cx="120" cy="90" r="44" strokeDasharray="2 8" />
      </g>
    </svg>
  )
  return (
    <svg className="empty-art" viewBox="0 0 320 210" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="87" cy="151" r="37" /><circle cx="232" cy="151" r="37" />
        <circle cx="87" cy="151" r="29" opacity=".3" /><circle cx="232" cy="151" r="29" opacity=".3" />
        <path d="m87 151 46-64 37 64H87Zm46-64h53l46 64M133 87l-13-19h-16M170 151l-18-95M145 56h18M186 75h23M207 75l25 76" />
        <path d="M136 66c-9-18 3-35 21-35 17 0 28 13 24 29-3 12-14 20-26 19" />
        <path d="M174 34c10-13 22-7 21 4 11-6 18 5 11 13 9 3 8 15-2 17" />
        <path d="M150 55c4 3 10 3 14 0M153 44h1M169 44h1" />
        <path d="M140 76c-8 2-14 8-16 16M179 72c9 1 15 6 18 13" />
        <path d="M40 188h240" strokeDasharray="1 7" opacity=".45" />
      </g>
    </svg>
  )
}
