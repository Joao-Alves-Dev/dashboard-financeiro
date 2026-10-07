'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { criarWorkspace } from '@/app/novo/actions'

export function FormNovoWorkspace() {
  const t = useTranslations('novoWorkspace')
  const tTipo = useTranslations('workspace.tipo')
  const [estado, acao, pendente] = useActionState(criarWorkspace, null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const campos = estado && !estado.ok ? estado.campos : undefined
  const tipos = [
    { value: 'pessoal', label: tTipo('pessoal') },
    { value: 'empresa', label: tTipo('empresa') },
  ]

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('titulo')}</CardTitle>
        <CardDescription>{t('descricao')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) => {
            setValores({ nome: String(fd.get('nome') ?? '') })
            acao(fd)
          }} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">{t('nome')}</Label>
            <Input id="nome" name="nome" defaultValue={valores.nome} placeholder={t('nomePlaceholder')} required aria-invalid={!!campos?.nome} />
            {campos?.nome && <p className="text-sm text-destructive">{campos.nome}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('tipo')}</Label>
            <Select name="tipo" defaultValue="pessoal" items={tipos}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {campos?.tipo && <p className="text-sm text-destructive">{campos.tipo}</p>}
          </div>
          {estado && !estado.ok && !campos && (
            <p role="alert" className="text-sm text-destructive">{estado.erro}</p>
          )}
          <Button type="submit" disabled={pendente}>
            {pendente ? t('criando') : t('criar')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
