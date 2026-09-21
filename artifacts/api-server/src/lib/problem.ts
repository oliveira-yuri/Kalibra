import type { Response } from 'express';

/**
 * Erro em `application/problem+json`.
 *
 * O `code` é **estável** e é o que o cliente compara. O `title` é descritivo para
 * quem lê log ou depura — **não é o texto que o usuário vê**. Mensagem de produto
 * em português é decisão de interface, e mandar o servidor escolhê-la abre o
 * caminho mais fácil para um detalhe interno vazar para a tela.
 *
 * `detail` é opcional e nunca deve carregar valor de ambiente, stack ou SQL. Há
 * teste que planta valores reconhecíveis nos segredos e varre o corpo e os
 * cabeçalhos de todas as respostas de erro procurando por eles.
 */
export type Problema = {
  status: number;
  /** Comparado pelo cliente. Mudar um `code` é mudança quebrante de contrato. */
  code: string;
  title: string;
  detail?: string;
};

export function responderProblema(res: Response, problema: Problema): void {
  res
    .status(problema.status)
    .type('application/problem+json')
    .json({
      type: `https://kalibra.app/problemas/${problema.code}`,
      title: problema.title,
      status: problema.status,
      code: problema.code,
      ...(problema.detail ? { detail: problema.detail } : {}),
    });
}
