import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../schema';

/**
 * Banco de teste: Postgres de verdade, compilado para WASM, em memória.
 *
 * Por que não mock: esta fase inteira existe para provar constraints — FKs
 * compostas, índice único parcial, cascatas. Um banco mocado não recusa nada, então
 * todo teste de integridade passaria sem verificar coisa nenhuma. Seria exatamente
 * o teste vacuoso que as fases anteriores aprenderam a caçar.
 *
 * Por que não Docker: não há Docker nem `psql` nesta máquina. PGlite roda no mesmo
 * processo do Vitest e aplica as mesmas migrations que o Postgres de produção vai
 * aplicar.
 *
 * **O que isto NÃO prova:** comportamento contra um Postgres real, em rede, com a
 * versão que for escolhida para produção. Enquanto não houver `DATABASE_URL`, o
 * documento de verificação registra isso como não verificado — não como verificado
 * por aproximação.
 */

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

export type TestDb = PgliteDatabase<typeof schema> & { $client: PGlite };

/**
 * Sobe uma instância e aplica as migrations. A instância é reusada entre os testes
 * de um arquivo — instanciar WASM custa caro — e `resetTables` limpa os dados entre
 * um teste e outro sem recriar o schema.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as TestDb;
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

/**
 * Esvazia todas as tabelas do schema público sem derrubar a estrutura.
 *
 * `truncate ... cascade` de uma vez só, e não tabela a tabela: a ordem correta
 * mudaria a cada chave estrangeira nova, e errá-la produziria falha de FK no meio
 * da limpeza — ruído que não diz nada sobre o teste.
 *
 * `restart identity` para que nenhum teste dependa de um contador herdado do
 * anterior.
 */
export async function resetTables(db: TestDb): Promise<void> {
  const { rows } = await db.execute<{ tabela: string }>(sql`
    select quote_ident(tablename) as tabela
    from pg_tables
    where schemaname = 'public' and tablename <> '__drizzle_migrations'
  `);
  if (rows.length === 0) return;
  const lista = rows.map((linha) => `public.${linha.tabela}`).join(', ');
  await db.execute(sql.raw(`truncate table ${lista} restart identity cascade`));
}
