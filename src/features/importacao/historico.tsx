'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Undo2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmarDialogo } from '@/components/confirmar-dialogo'
import { desfazerImportacao } from './actions'
import type { ItemHistorico } from './queries'

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export function Historico({ workspaceId, itens }: { workspaceId: string; itens: ItemHistorico[] }) {
  const t = useTranslations('importacao.historico')
  // `alvo` permanece após fechar para o texto não mudar durante a animação de saída.
  const [alvo, setAlvo] = useState<ItemHistorico | null>(null)
  const [aberto, setAberto] = useState(false)

  return (
    <section aria-labelledby="titulo-historico" className="flex flex-col gap-3">
      <h2 id="titulo-historico" className="text-lg font-semibold tracking-tight">
        {t('titulo')}
      </h2>
      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('vazio')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{t('linha', { arquivo: i.arquivoNome, conta: i.contaNome })}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="uppercase">
                    {i.formato}
                  </Badge>
                  {t('detalhe', {
                    qtd: i.qtdLancamentos,
                    data: formatadorData.format(new Date(i.criadoEm)),
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                  setAlvo(i)
                  setAberto(true)
                }}>
                <Undo2Icon />
                {t('desfazer')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmarDialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo={t('desfazerTitulo')}
        texto={t('desfazerTexto', { qtd: alvo?.qtdLancamentos ?? 0, arquivo: alvo?.arquivoNome ?? '' })}
        rotuloConfirmar={t('desfazerConfirmar')}
        rotuloPendente={t('desfazendo')}
        aoConfirmar={async () => {
          if (!alvo) return null
          const r = await desfazerImportacao(workspaceId, alvo.id)
          return r.ok ? null : r.erro
        }}
      />
    </section>
  )
}
