'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ABAS, type Aba } from './abas'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AbasConfig({
  inicial,
  contas,
  categorias,
  regras,
}: {
  inicial: Aba
  contas: ReactNode
  categorias: ReactNode
  regras: ReactNode
}) {
  const t = useTranslations('config.abas')
  const [aba, setAba] = useState<string>(inicial)
  return (
    <Tabs value={aba} onValueChange={(v) => setAba(String(v))}>
      <TabsList>
        {ABAS.map((a) => (
          <TabsTrigger key={a} value={a} className="px-3">
            {t(a)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="contas" className="pt-2">
        {contas}
      </TabsContent>
      <TabsContent value="categorias" className="pt-2">
        {categorias}
      </TabsContent>
      <TabsContent value="regras" className="pt-2">
        {regras}
      </TabsContent>
    </Tabs>
  )
}
