import { useTranslations } from 'next-intl'
import { CheckCircle2Icon } from 'lucide-react'
import { CartaoAlerta } from './cartao-alerta'
import type { Alerta } from './tipos'

/** Alertas ativos (já ordenados por gravidade) ou o estado vazio positivo. */
export function ListaAlertas({ workspaceId, alertas }: { workspaceId: string; alertas: Alerta[] }) {
  const t = useTranslations('orientador.alertas')
  return (
    <section aria-labelledby="alertas-titulo" className="flex flex-col gap-3">
      <h2 id="alertas-titulo" className="text-lg font-semibold">
        {t('titulo')}
      </h2>
      {alertas.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-5">
          <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--status-bom)" />
          <div>
            <p className="font-medium">{t('vazioTitulo')}</p>
            <p className="text-sm text-muted-foreground">{t('vazioTexto')}</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {alertas.map((a) => (
            <li key={`${a.regraId}:${a.chave}`}>
              <CartaoAlerta workspaceId={workspaceId} alerta={a} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
