export function SvgImage({ svg, alt, className = '' }: { svg: string; alt: string; className?: string }) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return <img className={`svg-image ${className}`} src={src} alt={alt} draggable={false} />
}
