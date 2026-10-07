import { getTranslations } from 'next-intl/server'
import { EmBreve } from '@/components/em-breve'

// Placeholder até a task correspondente.
export default async function Pagina() {
  const t = await getTranslations('nav')
  return <EmBreve titulo={t('importar')} />
}
