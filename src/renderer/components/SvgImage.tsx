import { useEffect, useMemo } from 'react'

export function SvgImage({ svg, alt, className = '', eager = false }: { svg: string; alt: string; className?: string; eager?: boolean }) {
  const src = useMemo(() => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })), [svg])
  useEffect(() => () => URL.revokeObjectURL(src), [src])
  return <img className={`svg-image ${className}`} src={src} alt={alt} draggable={false} loading={eager ? 'eager' : 'lazy'} decoding="async" />
}
