/** Route remote listing photos through our relay; leave local assets alone. */
export function proxied(url: string): string {
  if (!url) return url
  if (url.startsWith('/') || url.startsWith('data:')) return url
  return `/api/img?u=${encodeURIComponent(url)}`
}

export function formatPrice(price: number | null, currency = 'EUR'): string {
  if (price === null) return 'No price'
  try {
    return new Intl.NumberFormat('nl-BE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return `€${price.toLocaleString('nl-BE')}`
  }
}
