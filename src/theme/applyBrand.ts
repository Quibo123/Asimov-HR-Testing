export type Brand = { logoUrl: string; primary: string }

export function applyBrand(brand: Brand) {
  document.documentElement.style.setProperty('--brand', brand.primary)
  const logo = document.getElementById('tenant-logo') as HTMLImageElement | null
  if (logo) logo.src = brand.logoUrl
}

export const fakeBrandA: Brand = { logoUrl: 'https://placehold.co/120x40/F95E0E/fff?text=A', primary: '#F95E0E' }
export const fakeBrandB: Brand = { logoUrl: 'https://placehold.co/120x40/0E7CF9/fff?text=B', primary: '#0E7CF9' }