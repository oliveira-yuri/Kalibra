import type { Request, Response } from 'express';
import { responderProblema } from './problem';

/**
 * Concorrência otimista sobre `workspace.version`.
 *
 * O caso real é banal e destrutivo: o usuário abre o mesmo concurso em duas abas,
 * edita numa, edita na outra, e a segunda escrita apaga a primeira sem que nada
 * indique que houve perda. O cliente manda a versão que leu; se ela já não é a
 * atual, o servidor recusa e a interface tem a chance de dizer algo.
 *
 * A versão é **por workspace**, não por documento (§2 da Fase 2): grosseira —
 * qualquer escrita relevante a incrementa — mas simples e correta. Uma versão por
 * documento exigiria decidir o que conta como documento, e errar essa divisão
 * devolve o problema que o mecanismo existe para resolver.
 */

export type ResultadoDaPrecondicao =
  | { ok: true; versaoLida: number }
  | { ok: false };

/**
 * Lê e confere o `If-Match`. **Responde ela mesma** quando recusa — por isso
 * devolve `ok: false` sem detalhe: quem chama só precisa parar.
 *
 * **Não existe "esqueci a versão, sobrescreve assim mesmo".** A ausência do
 * cabeçalho é 428 e não um caminho permissivo: um cliente que não sabe a versão
 * não sabe o que está sobrescrevendo, e deixá-lo passar tornaria o mecanismo
 * inútil justamente para quem mais precisa dele.
 */
export function conferirPrecondicao(
  req: Request,
  res: Response,
  versaoAtual: number,
): ResultadoDaPrecondicao {
  const cabecalho = req.header('If-Match');

  if (cabecalho === undefined || cabecalho.trim() === '') {
    responderProblema(res, {
      status: 428,
      code: 'precondition_required',
      title: 'Cabeçalho If-Match obrigatório',
    });
    return { ok: false };
  }

  // Aspas são sintaxe legítima de ETag (`W/"3"`, `"3"`). Aceitar as duas formas
  // evita recusar um cliente correto por causa de formatação.
  const numero = Number(cabecalho.replace(/^W\//, '').replace(/"/g, '').trim());

  if (!Number.isInteger(numero) || numero !== versaoAtual) {
    responderProblema(res, {
      status: 412,
      code: 'precondition_failed',
      title: 'A versão enviada não é a atual',
    });
    return { ok: false };
  }

  return { ok: true, versaoLida: numero };
}
