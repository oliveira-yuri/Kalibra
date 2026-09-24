import { createServer, type Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@workspace/db';
import type { Db } from '@workspace/db';
import { criarApp, type ExtratorDeUsuario } from '../criar-app';
import { acharMigrations } from './migrations';

/**
 * Um `api-server` de verdade, sobre PGlite, para a suíte de TELAS do frontend usar.
 *
 * **Por que um servidor compartilhado e não um por arquivo:** PGlite não roda sob
 * jsdom — falha ao migrar, porque o `fetch` daquele ambiente não entrega
 * `arrayBuffer` — e os testes de tela precisam de jsdom para renderizar React. A
 * saída é subir o servidor no `globalSetup` do Vitest, que roda em Node, e deixar
 * os arquivos de teste falarem HTTP com ele.
 *
 * **O isolamento entre arquivos é o do próprio produto.** Todos compartilham o
 * banco, e cada arquivo usa um usuário diferente — como a API filtra tudo por
 * `user_id` na cláusula `where`, um arquivo não enxerga o do outro. Não é um truque
 * de teste: é a mesma garantia que protege dois usuários reais, exercitada de
 * graça a cada execução.
 *
 * **O extrator daqui lê um cabeçalho, e isso NÃO é porta dos fundos.** Este arquivo
 * vive em `src/test/` e nenhum código de produção o importa — há teste estrutural
 * da Fase 3 fixando isso. `app.ts` continua sendo o wiring real, sem extrator
 * injetado, e outro teste confirma que ele não passa nenhum.
 */

export const CABECALHO_DE_USUARIO = 'x-usuario-de-teste';

const lerUsuarioDoCabecalho: ExtratorDeUsuario = (req) => {
  const valor = req.header(CABECALHO_DE_USUARIO);
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
};

export type ServidorCompartilhado = {
  baseUrl: string;
  encerrar(): Promise<void>;
};

export async function subirServidorCompartilhado(): Promise<ServidorCompartilhado> {
  process.env.CLERK_SECRET_KEY ??= 'sk_test_marcador_sintatico_nao_e_segredo';

  const client = new PGlite();
  const dbPglite = drizzle(client, { schema });
  await migrate(dbPglite, { migrationsFolder: acharMigrations() });

  const app = criarApp({
    db: dbPglite as unknown as Db,
    extrairUserId: lerUsuarioDoCabecalho,
  });

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async encerrar() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await client.close();
    },
  };
}
