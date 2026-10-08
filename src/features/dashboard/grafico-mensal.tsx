import { getTranslations } from 'next-intl/server'
import { CardDashboard, EstadoVazio } from './card-dashboard'
import { GraficoMensalBarras } from './grafico-mensal-barras'
import { obterSerieMensal } from './queries'
import { temMovimento } from './serie'

export async function GraficoMensalBloco({ ws, hoje }: { ws: string; hoje: string }) {
  const [t, serie] = await Promise.all([getTranslations('dashboard.grafico'), obterSerieMensal(ws, hoje)])
  return (
    <CardDashboard id="grafico-mensal" titulo={t('titulo')} descricao={t('descricao')}>
      {temMovimento(serie) ? <GraficoMensalBarras serie={serie} /> : <EstadoVazio>{t('vazio')}</EstadoVazio>}
    </CardDashboard>
  )
}
