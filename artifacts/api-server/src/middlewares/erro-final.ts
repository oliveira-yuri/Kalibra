import type { Request, Response, NextFunction } from 'express';
import { responderProblema } from '../lib/problem';
import { logger } from '../lib/logger';

/**
 * O último middleware da cadeia. Converte qualquer erro não tratado em
 * `problem+json` e **não deixa passar nada de dentro**.
 *
 * Sem ele, o Express responde com a página de erro padrão — que inclui a mensagem
 * e a **stack completa** em HTML. Isso já apareceu neste projeto: sem
 * `CLERK_SECRET_KEY`, a resposta trazia caminho de arquivo, linha e a cadeia de
 * chamadas inteira. Uma mensagem de driver de banco traria o SQL, e um erro de
 * conexão traria a string de conexão — com a senha dentro.
 *
 * Por isso o corpo é **fixo**: nem `error.message`, nem `detail` derivado. O que
 * um erro interno significa para quem investiga vai para o log do servidor; o que
 * volta para o cliente é só que algo falhou e um `code` estável.
 *
 * Há teste que planta valores reconhecíveis nos três segredos e varre corpo e
 * cabeçalhos de 401, 404 e de um erro interno provocado de verdade.
 */
export function erroFinal(
  erro: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(erro);
    return;
  }

  // O detalhe vai para o log, onde é útil e não é exposto.
  logger.error({ err: erro }, 'erro não tratado numa rota');

  responderProblema(res, {
    status: 500,
    code: 'erro_interno',
    title: 'Erro interno',
  });
}
