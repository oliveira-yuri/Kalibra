import { createServer, type Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import * as schema from '@workspace/db';
import { criarApp, type ExtratorDeUsuario } from '../criar-app';
import type { Db } from '@workspace/db';

/**
 * Sobe o app REAL numa porta efêmera e fala HTTP com ele.
 *
 * Por que HTTP de verdade e não chamar o handler direto: o que esta fase precisa
 * provar mora nos middlewares — ordem de montagem, 401 antes de qualquer rota,
 * cabeçalho de resposta de erro. Chamar o handler por dentro pularia exatamente a
 * parte que interessa.
 *
 * Sem `supertest`: `fetch` contra uma porta efêmera resolve, e evita uma
 * dependência nova num repositório que trata dependência como superfície de
 * ataque.
 */

const MIGRATIONS = new URL('../../../../lib/db/migrations', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/**
 * `clerkMiddleware()` CONSTRÓI sem segredo, mas LANÇA ao atender a primeira
 * requisição — "Missing Clerk Secret Key" — e toda resposta vira 500.
 *
 * Esta constante existe para destravar isso e **não é um segredo**: é um
 * marcador sintático que permite ao middleware inicializar. Com ela, o Clerk
 * trata toda requisição sem token como "sem sessão", que é justamente o caso que
 * o 401 precisa exercitar. Nenhuma credencial real entra aqui, e nenhuma é
 * necessária: esta fase não valida token de verdade contra o Clerk.
 *
 * Registrado no documento de verificação: **nada foi exercitado contra o Clerk
 * real.**
 */
const CHAVE_FALSA_DE_TESTE = 'sk_test_marcador_sintatico_nao_e_segredo';

export type Sessao = { clerkUserId: string } | null;

export type Harness = {
  pedir(caminho: string, init?: RequestInit): Promise<Response>;
  /** Quem está autenticado. `null` = ninguém, que é o caso que o 401 defende. */
  entrarComo(sessao: Sessao): void;
  db: Db;
  limpar(): Promise<void>;
  encerrar(): Promise<void>;
};

/**
 * @param injetarSessao quando `false`, monta o app SEM extrator injetado — ou
 * seja, no caminho de produção, com `getAuth(req)` do Clerk. É assim que se prova
 * que o padrão da fábrica não é permissivo.
 */
export async function criarHarness({ injetarSessao = true } = {}): Promise<Harness> {
  process.env.CLERK_SECRET_KEY ??= CHAVE_FALSA_DE_TESTE;
  const client = new PGlite();
  // Duas visões do MESMO banco. `dbPglite` mantém os tipos do driver, para as
  // operações internas do harness; `db` é o mesmo objeto visto como `Db`, que é o
  // que a aplicação espera. O elenco fica confinado aqui — nenhuma rota o vê.
  const dbPglite = drizzle(client, { schema });
  const db = dbPglite as unknown as Db;
  await migrate(dbPglite, { migrationsFolder: MIGRATIONS });

  let sessao: Sessao = null;
  const extrairUserId: ExtratorDeUsuario = () => sessao?.clerkUserId ?? null;

  const app = criarApp(injetarSessao ? { db, extrairUserId } : { db });
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const porta = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${porta}`;

  return {
    pedir: (caminho, init) => fetch(`${base}${caminho}`, init),
    entrarComo: (nova) => { sessao = nova; },
    db,
    async limpar() {
      const { rows } = await dbPglite.execute<{ tabela: string }>(sql`
        select quote_ident(tablename) as tabela from pg_tables
        where schemaname = 'public' and tablename <> '__drizzle_migrations'
      `);
      if (rows.length === 0) return;
      const lista = rows.map((l) => `public.${l.tabela}`).join(', ');
      await dbPglite.execute(sql.raw(`truncate table ${lista} restart identity cascade`));
    },
    async encerrar() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await client.close();
    },
  };
}
