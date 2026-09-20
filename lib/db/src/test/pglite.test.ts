import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb, resetTables, type TestDb } from './pglite';

/**
 * Fumaça do harness. Sem ele, um harness quebrado apareceria como falha confusa
 * nos testes de constraint das tarefas seguintes — e o tempo iria para depurar a
 * constraint errada.
 */
describe('harness PGlite', () => {
  let db: TestDb;

  beforeAll(async () => { db = await createTestDb(); });
  afterEach(async () => { await resetTables(db); });

  it('sobe uma instância e responde a uma consulta', async () => {
    const { rows } = await db.execute<{ um: number }>(sql`select 1 as um`);
    expect(rows[0].um).toBe(1);
  });

  it('é um Postgres de verdade: recusa SQL inválido em vez de aceitar em silêncio', async () => {
    // A propriedade que justifica PGlite em vez de mock. Um mock aceitaria isto.
    await expect(db.execute(sql`select * from tabela_que_nao_existe`)).rejects.toThrow();
  });

  it('aplica as migrations: a tabela de controle do Drizzle existe', async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from information_schema.tables
      where table_name = '__drizzle_migrations'
    `);
    expect(rows[0].n).toBe(1);
  });

  it('resetTables não derruba o schema', async () => {
    await resetTables(db);
    const { rows } = await db.execute<{ um: number }>(sql`select 1 as um`);
    expect(rows[0].um).toBe(1);
  });
});
