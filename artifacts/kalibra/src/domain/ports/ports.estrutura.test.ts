import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Dois testes de estrutura, não de comportamento. Eles fixam o que a Fase 1A
 * conquistou e que nenhum teste de funcionalidade protegeria: a direção da
 * dependência entre porta e adaptador.
 *
 * Sem eles, o próximo desenvolvedor reintroduz o acoplamento — importa um tipo do
 * adaptador na porta, ou declara um tipo novo dentro do adaptador — e a suíte
 * inteira continua verde, porque o comportamento não muda. O estrago só aparece
 * na Fase 4, quando o harness de contrato precisar comparar dois adaptadores
 * contra um contrato que voltou a ser definido por um deles.
 */

const PORTS_DIR = join(__dirname);
const ADAPTERS_DIR = join(__dirname, '..', 'adapters', 'local');

/** Os quatro módulos que migram para a API na Fase 1C. */
const MODULOS_QUE_MIGRAM = ['workspaces', 'concepts', 'syllabus', 'approvals'] as const;

function lerPorta(arquivo: string): string {
  return readFileSync(join(PORTS_DIR, arquivo), 'utf8');
}

describe('estrutura das portas', () => {
  it('nenhuma porta importa de adapters/ — a seta aponta num sentido só', () => {
    const arquivos = readdirSync(PORTS_DIR).filter((nome) => nome.endsWith('.ts') && !nome.includes('.test.'));

    // Se esta lista esvaziar, o teste passaria por não ter o que verificar.
    expect(arquivos.length).toBeGreaterThan(0);

    const violacoes = arquivos.filter((nome) => /from\s+['"][^'"]*adapters\//.test(lerPorta(nome)));
    expect(violacoes).toEqual([]);
  });

  it('nenhum adaptador dos módulos que migram declara tipo de domínio', () => {
    // `extraction.ts` fica FORA de propósito: declara `ExtractionSourceMode` e
    // `ExtractionInput`, mas extração não é um dos módulos que migram para a API
    // nesta fase — então seus tipos continuam no adaptador, legitimamente.
    const violacoes = MODULOS_QUE_MIGRAM.flatMap((modulo) => {
      const fonte = readFileSync(join(ADAPTERS_DIR, `${modulo}.ts`), 'utf8');
      const declaracoes = fonte.match(/^export (type|interface) \w+/gm) ?? [];
      return declaracoes.map((declaracao) => `${modulo}.ts: ${declaracao}`);
    });

    expect(violacoes).toEqual([]);
  });
});
