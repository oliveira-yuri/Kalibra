/**
 * De onde veio o edital de um workspace.
 *
 * Morava em `artifacts/kalibra/src/domain/ports/workspaces.ts`, o que impedia
 * `lib/db` de usá-lo: o banco não pode importar da aplicação — seria inverter a
 * dependência. Por isso `workspace.source_mode` nasceu como `text` em vez de
 * `pgEnum`, com a dívida registrada na Fase 2 para vencer exatamente aqui, na
 * fase que migra o módulo de workspaces. O contrato da API precisa do tipo de
 * qualquer forma.
 *
 * `none` significa "ainda não importado" — não é ausência de valor. Um workspace
 * recém-criado tem `sourceMode: 'none'`, e é isso que distingue "não importei" de
 * "importei e deu errado" (que vive no `status`).
 */
export type SourceMode = 'file' | 'text' | 'none';

/**
 * Mesmo padrão de `WORKSPACE_STATUS_LABELS` e `APPROVAL_STATUSES`: a lista em
 * runtime é derivada de um `Record` completo, então o compilador recusa o literal
 * se faltar ou sobrar chave. A lista não pode ficar atrás do tipo — que é o
 * defeito que uma lista mantida à mão sempre acaba tendo.
 */
const SOURCE_MODE_SET: Record<SourceMode, true> = {
  file: true,
  text: true,
  none: true,
};

export const SOURCE_MODES: readonly SourceMode[] = Object.keys(SOURCE_MODE_SET) as SourceMode[];
