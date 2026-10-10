import { Fragment } from 'react'
import { AVISO_EDUCATIVO, ROTULO_EXEMPLO, type Dica } from './biblioteca'
import { renderizarCorpo, type Trecho } from './renderizar-corpo'

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.negrito ? (
          <strong key={i} className="font-semibold">
            {t.texto}
          </strong>
        ) : (
          <Fragment key={i}>{t.texto}</Fragment>
        ),
      )}
    </>
  )
}

/** Corpo da dica + aviso fixo. Sem hooks nem HTML cru: o markdown vira elementos React com texto comum. */
export function TextoDica({ dica }: { dica: Dica }) {
  const blocos = renderizarCorpo(dica.corpo)
  return (
    <article className="flex max-w-prose flex-col gap-4 leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">{dica.titulo}</h1>
      <p className="text-muted-foreground">{dica.resumo}</p>
      {blocos.map((b, i) => {
        switch (b.tipo) {
          case 'subtitulo':
            return (
              <h2 key={i} className="mt-2 text-lg font-semibold">
                {b.texto}
              </h2>
            )
          case 'lista':
            return (
              <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5">
                {b.itens.map((item, j) => (
                  <li key={j}>
                    <Trechos trechos={item} />
                  </li>
                ))}
              </ul>
            )
          case 'exemplo':
            return (
              <aside key={i} className="flex flex-col gap-1 rounded-lg border-l-4 border-border bg-muted/50 px-4 py-3 text-sm">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{ROTULO_EXEMPLO}</p>
                {b.linhas.map((l, j) => (
                  <p key={j}>
                    <Trechos trechos={l} />
                  </p>
                ))}
              </aside>
            )
          default:
            return (
              <p key={i}>
                <Trechos trechos={b.trechos} />
              </p>
            )
        }
      })}
      <p className="mt-2 border-t pt-3 text-sm text-muted-foreground">{AVISO_EDUCATIVO}</p>
    </article>
  )
}
