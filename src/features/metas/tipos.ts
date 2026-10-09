import type { aportesMeta, metas } from '@/db/schema'
import type { CalculoMeta } from './calcular-meta'

export type Meta = typeof metas.$inferSelect
export type MetaCalculada = Meta & { guardado: number; calculo: CalculoMeta }
export type Aporte = Pick<typeof aportesMeta.$inferSelect, 'id' | 'metaId' | 'data' | 'valorCentavos' | 'observacao'>
