import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { CheckCircle2Icon } from 'lucide-react'
import { CardDashboard } from '@/features/dashboard/card-dashboard'
import { CartaoAlerta } from './cartao-alerta'
import { listarAlertas } from './queries'

const MAX_ALERTAS = 3

/** Card do dashboard: os 3 alertas mais importantes (a lista já vem ordenada por gravidade) e o link para todos. */
export async function AlertasResumoBloco({ ws, hoje }: { ws: string; hoje: string }) {
  const [t, alertas] = await Promise.all([getTranslations('orientador.dashboard'), listarAlertas(ws, hoje)])
  const mostrados = alertas.slice(0, MAX_ALERTAS)

  return (
    <CardDashboard
      id="orientador-resumo"
      titulo={t('titulo')}
      descricao={mostrados.length > 0 ? t('descricao') : undefined}
      acao={
        <Link
          href={`/w/${ws}/orientacoes`}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('verTodas')}
        </Link>
      }
    >
      {mostrados.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-4">
          <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--status-bom)" />
          <div>
            <p className="font-medium">{t('vazioTitulo')}</p>
            <p className="text-sm text-muted-foreground">{t('vazioTexto')}</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {mostrados.map((a) => (
            <li key={`${a.regraId}:${a.chave}`}>
              <CartaoAlerta workspaceId={ws} alerta={a} compacto />
            </li>
          ))}
        </ul>
      )}
    </CardDashboard>
  )
}
