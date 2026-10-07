'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cadastrar } from '@/app/cadastro/actions'

export function FormCadastro() {
  const t = useTranslations('cadastro')
  const [estado, acao, pendente] = useActionState(cadastrar, null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const campos = estado && !estado.ok ? estado.campos : undefined

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('titulo')}</CardTitle>
        <CardDescription>{t('descricao')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) => {
            setValores({ nome: String(fd.get('nome') ?? ''), email: String(fd.get('email') ?? '') })
            acao(fd)
          }} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">{t('nome')}</Label>
            <Input id="nome" name="nome" defaultValue={valores.nome} autoComplete="name" required aria-invalid={!!campos?.nome} />
            {campos?.nome && <p className="text-sm text-destructive">{campos.nome}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" name="email" defaultValue={valores.email} type="email" autoComplete="email" required aria-invalid={!!campos?.email} />
            {campos?.email && <p className="text-sm text-destructive">{campos.email}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha">{t('senha')}</Label>
            <Input id="senha" name="senha" type="password" autoComplete="new-password" required aria-invalid={!!campos?.senha} />
            {campos?.senha ? (
              <p className="text-sm text-destructive">{campos.senha}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('senhaDica')}</p>
            )}
          </div>
          {estado && !estado.ok && !campos && (
            <p role="alert" className="text-sm text-destructive">{estado.erro}</p>
          )}
          <Button type="submit" disabled={pendente}>
            {pendente ? t('criando') : t('criar')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('jaTemConta')}{' '}
            <Link href="/login" className="underline underline-offset-4">{t('entrar')}</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
