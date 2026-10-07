import { getTranslations } from 'next-intl/server'

export async function EmBreve({ titulo }: { titulo: string }) {
  const t = await getTranslations('comum')
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <p className="text-muted-foreground">
        {t('emBreve')}. {t('emBreveTexto')}
      </p>
    </section>
  )
}
