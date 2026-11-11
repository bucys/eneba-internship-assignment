const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error('VITE_API_URL is not set. Copy client/.env.example to client/.env.')
}

export const env = {
  apiUrl: apiUrl.replace(/\/+$/, ''),
}
