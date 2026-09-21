import type { Request, Response, NextFunction } from 'express';
import { responderProblema } from '../lib/problem';

/**
 * Rota que não existe também responde `problem+json`.
 *
 * Sem este middleware, o Express trata "nenhuma rota casou" pelo caminho de erro
 * padrão e devolve **HTML** — `Cannot GET /api/rota-que-nao-existe` dentro de uma
 * página. Medido na Tarefa D4: a varredura de segredos passava, porque aquela
 * página não contém nenhum, mas a uniformidade que a seção C afirmava tinha esse
 * buraco. `erroFinal` não o cobre: ele é tratador de ERRO, e 404 de rota
 * desconhecida não lança nada.
 *
 * O corpo é fixo pela mesma razão do `erroFinal`: nada derivado da requisição
 * volta para o cliente. O caminho pedido é dado do cliente, não segredo, mas
 * ecoá-lo abriria a porta para o próximo campo ser derivado de outra coisa.
 *
 * Montado DEPOIS do router e ANTES do `erroFinal`.
 */
export function naoEncontrado(_req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next();
    return;
  }
  responderProblema(res, {
    status: 404,
    code: 'rota_nao_encontrada',
    title: 'Rota não encontrada',
  });
}
