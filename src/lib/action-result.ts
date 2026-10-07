export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; erro: string; campos?: Record<string, string> }
