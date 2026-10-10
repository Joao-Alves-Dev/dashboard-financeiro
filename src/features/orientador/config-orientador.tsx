'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { restaurarConfigOrientador, salvarConfigOrientador } from './actions'
import type { ConfigOrientador } from './tipos'

type Campo = 'limiteCategoriaPct' | 'altaPct' | 'cartaoPct'
const CAMPOS: { campo: Campo; rotulo: string; dica: string; max: number }[] = [
  { campo: 'limiteCategoriaPct', rotulo: 'limiteCategoria', dica: 'limiteCategoriaDica', max: 100 },
  { campo: 'altaPct', rotulo: 'alta', dica: 'altaDica', max: 500 },
  { campo: 'cartaoPct', rotulo: 'cartao', dica: 'cartaoDica', max: 100 },
]

/** Aba "Orientador" das configurações: os três limites em % e "Restaurar padrões". */
export function ConfigOrientadorForm({ workspaceId, config }: { workspaceId: string; config: ConfigOrientador }) {
  const t = useTranslations('orientador.config')
  const [valores, setValores] = useState<Record<Campo, string>>({
    limiteCategoriaPct: String(config.limiteCategoriaPct),
    altaPct: String(config.altaPct),
    cartaoPct: String(config.cartaoPct),
  })
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aplicar(c: ConfigOrientador) {
    setValores({
      limiteCategoriaPct: String(c.limiteCategoriaPct),
      altaPct: String(c.altaPct),
      cartaoPct: String(c.cartaoPct),
    })
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCampos({})
    setAviso(null)
    iniciar(async () => {
      const r = await salvarConfigOrientador(workspaceId, valores)
      if (r.ok) setAviso(t('salvo'))
      else {
        setErro(r.erro)
        setCampos(r.campos ?? {})
      }
    })
  }

  function restaurar() {
    setErro(null)
    setCampos({})
    setAviso(null)
    iniciar(async () => {
      const r = await restaurarConfigOrientador(workspaceId)
      if (r.ok) {
        aplicar(r.data)
        setAviso(t('restaurado'))
      } else setErro(r.erro)
    })
  }

  return (
    <section className="flex max-w-xl flex-col gap-4" aria-labelledby="orientador-config-titulo">
      <div>
        <h2 id="orientador-config-titulo" className="text-lg font-semibold">
          {t('titulo')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('descricao')}</p>
      </div>
      <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
        {CAMPOS.map(({ campo, rotulo, dica, max }) => (
          <div key={campo} className="flex flex-col gap-1.5">
            <Label htmlFor={`orientador-${campo}`}>{t(rotulo)}</Label>
            <Input
              id={`orientador-${campo}`}
              inputMode="numeric"
              autoComplete="off"
              value={valores[campo]}
              onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
              aria-invalid={!!campos[campo]}
              aria-describedby={`orientador-${campo}-dica`}
              maxLength={String(max).length}
              className="max-w-28"
            />
            <p id={`orientador-${campo}-dica`} className="text-sm text-muted-foreground">
              {t(dica)}
            </p>
            {campos[campo] ? <p className="text-sm text-destructive">{campos[campo]}</p> : null}
          </div>
        ))}
        {erro && Object.keys(campos).length === 0 ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <p role="status" className="min-h-5 text-sm text-muted-foreground">
          {aviso}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pendente}>
            {t('salvar')}
          </Button>
          <Button type="button" variant="outline" disabled={pendente} onClick={restaurar}>
            {t('restaurar')}
          </Button>
        </div>
      </form>
    </section>
  )
}
