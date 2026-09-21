import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

export type Db = NodePgDatabase<typeof schema> & { $client: pg.Pool };

/**
 * Abre a conexão com o Postgres — **quando chamada**, nunca na importação.
 *
 * A versão anterior deste módulo validava `DATABASE_URL` e criava um `Pool` no
 * topo do arquivo. Isso fazia duas coisas ruins de uma vez: exigia o segredo para
 * qualquer um que só quisesse os tipos do schema, e abria conexões TCP como efeito
 * colateral de `import` — inclusive num processo de teste que roda contra PGlite e
 * nunca vai falar com um Postgres real.
 *
 * É o mesmo padrão que a Fase 2 corrigiu em `drizzle.config.ts`: exigir credencial
 * para uma operação que não conecta em nada.
 *
 * A validação não sumiu, só mudou de momento: quem chama sem URL continua
 * recebendo erro imediato e explícito.
 */
export function criarDb(databaseUrl: string | undefined): Db {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL não está definida. O banco precisa ser provisionado e a variável '
      + 'exportada no ambiente do servidor — nunca no bundle do frontend.',
    );
  }
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema }) as Db;
}
