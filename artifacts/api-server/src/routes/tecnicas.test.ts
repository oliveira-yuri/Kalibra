import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(AQUI, '../../../kalibra/src');

/**
 * A Tarefa D2 decidiu que `/api/me` e `/api/users/:id` **ficam**, como rotas
 * técnicas de fundação, fora de OpenAPI, Orval, hook e tela.
 *
 * Este arquivo é o que impede essa decisão de ser só uma frase num comentário.
 * "Fora da UI" só vale enquanto alguém verifica; um `fetch('/api/me')` colado
 * numa tela passaria despercebido em revisão e transformaria uma rota de
 * fundação em dependência de produto — que é exatamente como o prazo de
 * validade delas seria perdido.
 */

function arquivosDe(raiz: string): string[] {
  const encontrados: string[] = [];
  const visitar = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      const caminho = join(dir, entrada);
      if (statSync(caminho).isDirectory()) visitar(caminho);
      else if (/\.(ts|tsx)$/.test(entrada)) encontrados.push(caminho);
    }
  };
  visitar(raiz);
  return encontrados;
}

/** As duas rotas técnicas, como apareceriam numa chamada do cliente. */
const AGULHAS = [/['"`]\/api\/me\b/, /['"`]\/api\/users\//];

describe('rotas técnicas de fundação ficam fora do produto (D2)', () => {
  const doFrontend = arquivosDe(FRONTEND);

  it('a varredura tem o que varrer', () => {
    // Sem isto, um caminho errado faria os testes abaixo passarem varrendo zero
    // arquivos — verdes e vazios.
    expect(doFrontend.length).toBeGreaterThan(50);
  });

  it('as agulhas realmente casam — provado contra o próprio arquivo de rota', () => {
    // E sem isto, uma regex quebrada faria a varredura nunca achar nada.
    const fonte = readFileSync(join(AQUI, 'tecnicas.ts'), 'utf8');
    const comoOClienteChamaria = fonte
      .replace(/router\.get\('\/me'/, "fetch('/api/me'")
      .replace(/router\.get\('\/users\/:id'/, "fetch('/api/users/' + id");
    for (const agulha of AGULHAS) expect(comoOClienteChamaria).toMatch(agulha);
  });

  it('nenhum arquivo do frontend chama /api/me nem /api/users/', () => {
    const chamadores = doFrontend.filter((caminho) => {
      const fonte = readFileSync(caminho, 'utf8');
      return AGULHAS.some((agulha) => agulha.test(fonte));
    });
    expect(chamadores.map((c) => relative(FRONTEND, c))).toEqual([]);
  });

  it('não existe OpenAPI nem cliente gerado nesta fase — quando existir, elas continuam fora', () => {
    // A Fase 3 não tem OpenAPI. Este teste fixa o estado de partida: se um
    // `openapi.yaml` aparecer no api-server, ele não pode nascer descrevendo as
    // rotas técnicas.
    const raiz = join(AQUI, '../..');
    const especificacoes = readdirSync(raiz).filter((n) => /openapi.*\.(ya?ml|json)$/i.test(n));
    for (const nome of especificacoes) {
      const fonte = readFileSync(join(raiz, nome), 'utf8');
      expect(fonte).not.toMatch(/\/api\/me\b|\/api\/users\//);
    }
  });
});
