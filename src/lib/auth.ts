export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const setAuthCookie = (operatorId: string, remember: boolean): void => {
  const maxAge = remember ? 60 * 60 * 24 * 30 : undefined // 30 días en segundos
  const parts = [
    `wms-auth-session=${operatorId}`,
    'path=/',
    'SameSite=Lax',
    ...(maxAge !== undefined ? [`Max-Age=${maxAge}`] : []),
  ]
  document.cookie = parts.join('; ')
}

export const clearAuthCookie = (): void => {
  document.cookie = 'wms-auth-session=; path=/; SameSite=Lax; Max-Age=0'
}
