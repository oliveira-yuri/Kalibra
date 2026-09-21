import { describe, it, expect } from 'vitest';
// Import estático de propósito: o módulo não tem mais efeito colateral, então
// carregá-lo no topo é seguro — e isso é exatamente o que este arquivo prova.
import { criarDb } from './connection';

/**
 * A propriedade que desbloqueia a Fase 3: importar `@workspace/db` não exige
 * segredo nem abre conexão.
 *
 * Antes disto, `artifacts/api-server` não conseguia nem ser IMPORTADO num teste
 * sem `DATABASE_URL` — e abria um pool TCP como efeito colateral de `import`, num
 * processo que só falaria com PGlite.
 */
describe('conexão sob demanda', () => {
  it('importar o pacote sem DATABASE_URL não lança', async () => {
    const anterior = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      // Import dinâmico para que a ausência da variável valha no momento da carga.
      const modulo = await import('./index');
      expect(typeof modulo.criarDb).toBe('function');
      expect(modulo.appUser).toBeDefined();
    } finally {
      if (anterior !== undefined) process.env.DATABASE_URL = anterior;
    }
  });

  it('criarDb sem URL lança com mensagem explícita', () => {
    // A validação não sumiu — mudou de momento. Quem chama sem URL erra na hora.
    expect(() => criarDb(undefined)).toThrow(/DATABASE_URL/);
  });

  it('o módulo não expõe mais um `db` pronto — quem precisa, constrói', async () => {
    // Um singleton exportado voltaria a amarrar a importação ao ambiente.
    const modulo = await import('./index');
    expect('db' in modulo).toBe(false);
    expect('pool' in modulo).toBe(false);
  });
});
