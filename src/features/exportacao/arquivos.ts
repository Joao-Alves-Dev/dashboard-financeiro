import { baixarArquivos, compartilharOuBaixar, nomeArquivoExportacao, type ResultadoCompartilhar } from './compartilhar'
import { renderizarPdf } from './render-pdf'
import type { Relatorio } from './relatorio'

/** O que identifica os arquivos de uma lista: nome no título e período (ISO). */
export type BaseArquivo = { nome: string; de: string; ate: string }

export function arquivosPng(blobs: Blob[], b: BaseArquivo): File[] {
  return blobs.map(
    (blob, i) =>
      new File([blob], nomeArquivoExportacao(b.nome, b.de, b.ate, 'png', { numero: i + 1, total: blobs.length }), {
        type: 'image/png',
      }),
  )
}

export async function arquivoPdf(r: Relatorio, b: BaseArquivo): Promise<File> {
  const blob = await renderizarPdf(r)
  return new File([blob], nomeArquivoExportacao(b.nome, b.de, b.ate, 'pdf'), { type: 'application/pdf' })
}

export function compartilharPng(blobs: Blob[], b: BaseArquivo, titulo: string): Promise<ResultadoCompartilhar> {
  return compartilharOuBaixar(arquivosPng(blobs, b), titulo)
}

export function baixarPng(blobs: Blob[], b: BaseArquivo): void {
  baixarArquivos(arquivosPng(blobs, b))
}

export async function baixarPdf(r: Relatorio, b: BaseArquivo): Promise<void> {
  baixarArquivos([await arquivoPdf(r, b)])
}
