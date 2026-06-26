import Image from 'next/image'

const PRODUCT_IMAGE: Record<string, string> = {
  'p-tshirt':
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=120&h=120&fit=crop&q=80&auto=format',
  'p-jeans':
    'https://images.unsplash.com/photo-1542272604-787c3835535d?w=120&h=120&fit=crop&q=80&auto=format',
  'p-sneakers':
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&h=120&fit=crop&q=80&auto=format',
  'p-jacket':
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=120&h=120&fit=crop&q=80&auto=format',
  'p-bag':
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=120&h=120&fit=crop&q=80&auto=format',
  'p-cap':
    'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=120&h=120&fit=crop&q=80&auto=format',
  'p-socks':
    'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=120&h=120&fit=crop&q=80&auto=format',
  'p-dress':
    'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=120&h=120&fit=crop&q=80&auto=format',
  'p-cargo':
    'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=120&h=120&fit=crop&q=80&auto=format',
  'p-hoodie':
    'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=120&h=120&fit=crop&q=80&auto=format',
}

interface ProductAvatarProps {
  productId: string
  name: string
}

export const ProductAvatar = ({ productId, name }: ProductAvatarProps) => {
  const src = PRODUCT_IMAGE[productId]
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="border-border/60 bg-muted size-11 shrink-0 overflow-hidden rounded-xl border shadow-sm">
        {src ? (
          <Image src={src} alt={name} width={44} height={44} className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs font-bold">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <span className="truncate text-sm leading-tight font-medium">{name}</span>
    </div>
  )
}
