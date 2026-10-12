import { JPEG_QUALITY, MAX_SIDE, fitWithin, jpgName } from './logic'

// Makes a photo smaller before it is sent. PDFs and unreadable files are returned unchanged.
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file // already small, keep the original
    return new File([blob], jpgName(file.name), { type: 'image/jpeg' })
  } catch {
    return file
  }
}