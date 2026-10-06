export type LinhaImportada = {
  linha: number
  data: string // YYYY-MM-DD
  descricao: string
  valorCentavos: number
  idExterno?: string
}

export type ErroLinha = { linha: number; motivo: string }

export type ResultadoParse = { linhas: LinhaImportada[]; erros: ErroLinha[] }

export type MapeamentoCsv = {
  colData: string
  colDescricao: string
  colValor: string
  inverterSinal: boolean
}
