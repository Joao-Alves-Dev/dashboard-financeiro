import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'

/** Workspace sem nenhum lançamento: convida a importar um extrato ou registrar o primeiro lançamento. */
export async function DashboardVazio({ ws }: { ws: string }) {
  const t = await getTranslations('dashboard.vazio')
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <div>
        <h2 className="text-lg font-semibold">{t('titulo')}</h2>
        <p className="mt-1 max-w-prose text-muted-foreground">{t('texto')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/w/${ws}/importar`} className={buttonVariants()}>
          {t('importar')}
        </Link>
        <Link href={`/w/${ws}/lancamentos`} className={buttonVariants({ variant: 'outline' })}>
          {t('lancar')}
        </Link>
      </div>
    </section>
  )
}
