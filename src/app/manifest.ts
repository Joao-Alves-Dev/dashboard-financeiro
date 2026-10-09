import type { MetadataRoute } from 'next'

// Sem service worker e sem modo offline (decisão do spec): o manifest só torna o app instalável.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dashboard Financeiro',
    short_name: 'Finanças',
    description: 'Controle financeiro pessoal e da empresa.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
