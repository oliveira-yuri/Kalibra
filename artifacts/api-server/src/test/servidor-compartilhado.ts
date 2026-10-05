import { createServer, type Server } from 'node:http';
import express from 'express';
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

  /**
   * Rota de SEMEADURA, montada só aqui.
   *
   * Os blocos do edital são leitura na Fase 5 — a escrita dedicada,
   * `PUT /workspaces/{slug}/source-blocks`, é da Fase 6. Mas os testes de tela
   * precisam de um workspace COM blocos para exercitar a hidratação do editor, que
   * é justamente o que a Fase 1B.5 consertou.
   *
   * Esta rota existe para isso e só para isso. Vive em `src/test/`, `app.ts` nunca
   * a monta, e o teste estrutural da Fase 3 continua fixando que nenhum arquivo de
   * produção importa daqui. **A Fase 6 a apaga** quando o endpoint real existir —
   * ela tem de propósito a mesma forma dele.
   */
  // Montada num app EXTERNO que delega ao real. `criarApp` põe `naoEncontrado` e
  // `erroFinal` por último, de propósito — registrar aqui depois dele faria a rota
  // nunca ser alcançada. Envolver preserva a ordem do app de produção em vez de
  // furá-la.
  const externo = express();
  externo.use(express.json());
  externo.put('/api/_teste/workspaces/:slug/source-blocks', async (req, res) => {
    const { workspace, editalSourceBlock } = await import('@workspace/db');
    const { eq, and } = await import('drizzle-orm');
    const db = dbPglite as unknown as Db;

    const clerkUserId = lerUsuarioDoCabecalho(req);
    if (!clerkUserId) { res.status(401).end(); return; }
    const { ensureAppUser } = await import('../lib/ensure-app-user');
    const userId = await ensureAppUser(db, { clerkUserId });

    const [linha] = await db.select().from(workspace)
      .where(and(eq(workspace.slug, req.params.slug), eq(workspace.userId, userId)));
    if (!linha) { res.status(404).end(); return; }

    const blocos = (req.body as { blocks?: { cargoId: string | null; text: string }[] }).blocks ?? [];
    await db.delete(editalSourceBlock).where(eq(editalSourceBlock.workspaceId, linha.id));
    if (blocos.length > 0) {
      await db.insert(editalSourceBlock).values(blocos.map((b, i) => ({
        workspaceId: linha.id, cargoId: b.cargoId, text: b.text, position: i,
      })));
    }
    res.status(204).end();
  });
  externo.use(app);

  const server: Server = createServer(externo);
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
