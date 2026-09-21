import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A fronteira entre "schema preparatório é aceitável" e "código sem chamador não é".
 *
 * **Exportar não é usar.** O `drizzle-kit` só enxerga o que o barril exporta, então
 * a exportação é obrigatória para a migration existir. O que este teste proíbe é
 * código de aplicação — endpoint, adaptador, hook, serviço, tela ou teste de
 * aplicação — tratar estas tabelas como se a feature já existisse.
 *
 * Sem isto, alguém acrescenta um endpoint de questões "só para adiantar", ele fica
 * sem chamador do outro lado, e a fase que implementar o diagnóstico encontra meia
 * feature construída contra um schema que ainda ia mudar.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..', '..', '..', '..');

/** Os símbolos que o código de aplicação não pode nomear. */
const SIMBOLOS = [
  'question', 'questionAttempt', 'exam', 'examQuestion', 'diagnosticResult',
] as const;

/** Onde mora código de aplicação. `lib/db` é a casa das tabelas, e fica de fora. */
const AREAS = ['artifacts'];

function arquivosDeCodigo(raiz: string): string[] {
  const achados: string[] = [];
  const visitar = (dir: string) => {
    let entradas: string[];
    try {
      entradas = readdirSync(dir);
    } catch {
      return;
    }
    for (const entrada of entradas) {
      if (entrada === 'node_modules' || entrada === 'dist' || entrada.startsWith('.')) continue;
      const caminho = join(dir, entrada);
      if (statSync(caminho).isDirectory()) visitar(caminho);
      else if (/\.(ts|tsx)$/.test(entrada)) achados.push(caminho);
    }
  };
  visitar(raiz);
  return achados;
}

describe('tabelas preparatórias: existem no schema, sem chamador na aplicação', () => {
  const arquivos = AREAS.flatMap((area) => arquivosDeCodigo(join(RAIZ, area)));

  it('a varredura encontra código de aplicação para varrer', () => {
    // Sem isto, um caminho errado faria o teste abaixo passar por não ter o que ler.
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it('o FRONTEND não importa @workspace/db — código de servidor não vaza para o bundle', () => {
    // Refinado na Fase 3. A versão anterior proibia QUALQUER arquivo em
    // `artifacts/` de importar `@workspace/db` — bom proxy enquanto nada usava o
    // banco, e errado assim que o `api-server` passou a existir: importar o schema
    // e a conexão é literalmente a função dele.
    //
    // O que continua proibido é o que de fato importa: o frontend tocar no banco.
    // Isso levaria driver de Postgres e credencial para dentro do bundle que roda
    // no navegador do usuário.
    const doFrontend = arquivos.filter((c) => c.includes(join('artifacts', 'kalibra')));
    expect(doFrontend.length).toBeGreaterThan(50);

    const importadores = doFrontend.filter((caminho) =>
      /from\s+['"]@workspace\/db['"]/.test(readFileSync(caminho, 'utf8')));
    expect(importadores.map((c) => relative(RAIZ, c))).toEqual([]);
  });

  it.each(SIMBOLOS)('nenhum arquivo de aplicação nomeia a tabela "%s"', (simbolo) => {
    // Casa o símbolo como identificador importado ou usado, não como palavra solta
    // em comentário ou string — `question` aparece em texto de produto o tempo todo.
    const padrao = new RegExp(`\\b${simbolo}\\s*\\.(select|insert|update|delete|\\$inferSelect|\\$inferInsert)\\b`);
    const usos = arquivos.filter((caminho) => padrao.test(readFileSync(caminho, 'utf8')));
    expect(usos.map((c) => relative(RAIZ, c))).toEqual([]);
  });
});
