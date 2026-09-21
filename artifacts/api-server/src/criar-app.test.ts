import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarHarness, type Harness } from './test/harness';

const AQUI = dirname(fileURLToPath(import.meta.url));

describe('a fábrica monta o app real', () => {
  let h: Harness;
  beforeAll(async () => { h = await criarHarness(); });
  afterAll(async () => { await h.encerrar(); });

  it('responde no /api/healthz com o app de verdade, sobre HTTP', async () => {
    // Fumaça do harness: se isto falhar, as falhas das tarefas seguintes seriam
    // sobre a coisa errada.
    const r = await h.pedir('/api/healthz');
    expect(r.status).toBe(200);
  });
});

/**
 * As três guardas contra a injeção virar porta dos fundos.
 *
 * O risco é concreto: um parâmetro criado para teste que acaba permitindo, em
 * produção, autenticar sem Clerk. Nenhuma delas é redundante — cada uma fecha um
 * caminho diferente pelo qual isso aconteceria.
 */
describe('a injeção de sessão não é porta dos fundos', () => {
  // A quarta guarda — montar SEM injeção e exigir 401 numa rota protegida — vive
  // em `require-auth.test.ts` (seção B), porque precisa de `requireAuth` e de uma
  // rota que exija sessão. Sem elas, o teste responderia 404 e não provaria nada
  // sobre autenticação. Mesma dependência invertida da Fase 2, quando o harness
  // PGlite só pôde ser verificado depois da primeira migration existir.

  it('nenhum arquivo de produção importa de src/test/', () => {
    // É assim que o dublê vaza de verdade: não por alguém decidir, por um import
    // descuidado num arquivo que depois vai para produção.
    const arquivos: string[] = [];
    const visitar = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const caminho = join(dir, entrada);
        if (statSync(caminho).isDirectory()) {
          if (entrada !== 'test') visitar(caminho);
        } else if (/\.ts$/.test(entrada) && !/\.test\.ts$/.test(entrada)) {
          arquivos.push(caminho);
        }
      }
    };
    visitar(AQUI);

    expect(arquivos.length).toBeGreaterThan(3);
    const vazamentos = arquivos.filter((c) => /from\s+['"][^'"]*\/test\//.test(readFileSync(c, 'utf8')));
    expect(vazamentos.map((c) => relative(AQUI, c))).toEqual([]);
  });

  it('app.ts é o wiring de produção: usa criarDb e NÃO passa extrator', () => {
    const fonte = readFileSync(join(AQUI, 'app.ts'), 'utf8');
    expect(fonte).toMatch(/criarDb\(process\.env\.DATABASE_URL\)/);
    // A ausência é a garantia: passar um extrator aqui seria a porta dos fundos.
    expect(fonte).not.toMatch(/extrairUserId\s*:/);
  });

  it('o extrator padrão da fábrica é o do Clerk', () => {
    const fonte = readFileSync(join(AQUI, 'criar-app.ts'), 'utf8');
    expect(fonte).toMatch(/extrairUserId = extrairClerkUserId/);
    expect(fonte).toMatch(/getAuth\(req\)/);
  });
});
