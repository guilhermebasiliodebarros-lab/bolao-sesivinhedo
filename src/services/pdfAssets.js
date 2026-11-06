const base64 = (buffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}
let assetPromise
export function loadPDFAssets() {
  assetPromise ??= Promise.all(['/fonts/NotoSans-Regular.ttf', '/logo-interclasse.png'].map(async (url) => {
    const result = await fetch(url)
    if (!result.ok) throw new Error('Não foi possível carregar os recursos do PDF. Confira sua conexão e tente novamente.')
    return base64(await result.arrayBuffer())
  })).catch((error) => { assetPromise = null; throw error })
  return assetPromise
}
