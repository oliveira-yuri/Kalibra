import type { Request, Response, NextFunction } from 'express';
import type { ExtratorDeUsuario } from '../criar-app';
import { responderProblema } from '../lib/problem';

/**
 * A fronteira de autenticação. Nada privado passa daqui sem sessão válida.
 *
 * O `clerkUserId` vem **só** do extrator — que em produção lê o token validado
 * pelo Clerk. Nunca de `body`, `query` ou `path`: dado que o cliente manda não
 * declara quem ele é. Um `userId` que chegue no corpo não é erro de validação,
 * é campo que o servidor não lê.
 *
 * **Recusa antes de tocar o banco.** A ordem importa: consultar o banco para
 * depois descobrir que não havia sessão daria a um anônimo o poder de fazer o
 * servidor trabalhar. Há teste que conta acessos ao banco para provar isso por
 * execução, não por leitura deste comentário.
 */
/**
 * O `clerkUserId` da sessão vive em `res.locals`, que é onde o Express guarda
 * dado por requisição. Ler daqui é a ÚNICA forma autorizada de uma rota saber
 * quem está falando — nunca de `req.body`, `req.query` ou `req.params`.
 */
export function usuarioDaSessao(res: Response): string {
  const id = res.locals.clerkUserId as string | undefined;
  if (!id) throw new Error('usuarioDaSessao chamado numa rota que não passou por requireAuth');
  return id;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const extrair = req.app.get('extrairUserId') as ExtratorDeUsuario;
  const clerkUserId = extrair(req);

  if (!clerkUserId) {
    responderProblema(res, {
      status: 401,
      code: 'sessao_ausente',
      title: 'Sessão ausente ou inválida',
    });
    return;
  }

  res.locals.clerkUserId = clerkUserId;
  next();
}
