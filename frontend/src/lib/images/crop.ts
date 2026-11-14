// Serialise multi-file selections: each image gets an explicit decision.
let pending: Promise<unknown> = Promise.resolve()
export function cropImage(file: File, avatar = false): Promise<File | null> {
  const result = pending.then(async () => {
    const { openImageCropper } = await import('@/components/images/ImageCropper')
    return openImageCropper(file, avatar)
  })
  pending = result.catch(() => {})
  return result
}

export function imageDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read this image.'))
    reader.readAsDataURL(file)
  })
}
