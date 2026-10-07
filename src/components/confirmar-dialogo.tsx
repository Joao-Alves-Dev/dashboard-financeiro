'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Props = {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  titulo: string
  texto: ReactNode
  rotuloConfirmar: string
  /** Executa a ação; devolve mensagem de erro ou null em sucesso (o diálogo fecha). */
  aoConfirmar: () => Promise<string | null>
}

/** Confirmação destrutiva: mostra o erro da action sem fechar. */
export function ConfirmarDialogo({ aberto, aoMudar, titulo, texto, rotuloConfirmar, aoConfirmar }: Props) {
  const t = useTranslations('comum')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) setErro(null)
        aoMudar(v)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{texto}</AlertDialogDescription>
        </AlertDialogHeader>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancelar')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const e = await aoConfirmar()
                if (e) setErro(e)
                else aoMudar(false)
              })
            }
          >
            {pendente ? t('excluindo') : rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
