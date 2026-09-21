import { Router, type IRouter } from 'express';
import { eq, and } from 'drizzle-orm';
import { appUser, type Db } from '@workspace/db';
import { requireAuth, usuarioDaSessao } from '../middlewares/require-auth';
import { ensureAppUser } from '../lib/ensure-app-user';
import { responderProblema } from '../lib/problem';

/**
 * ROTAS TÉCNICAS DE FUNDAÇÃO — **não são recurso de produto.**
 *
 * Existem para que autenticação, posse e formato de erro tenham o que exercitar
 * antes de qualquer recurso de domínio existir. Não entram no OpenAPI, não geram
 * hook, não são consumidas por tela nenhuma.
 *
 * A Tarefa D2 decide explicitamente se ficam ou saem quando a Fase 5 trouxer
 * workspaces — a regra registrada é "tabela sem endpoint é aceitável; código sem
 * chamador não é", e um endpoint cujo único chamador é teste está na fronteira.
 */
const router: IRouter = Router();

router.use(requireAuth);

/**
 * Quem sou eu, segundo a SESSÃO.
 *
 * O `clerkUserId` vem de `res.locals`, posto por `requireAuth` a partir do
 * token — nunca de `body`, `query` ou `path`. Os testes mandam `userId` de outro
 * usuário nos três lugares e exigem que a resposta continue sendo a do dono da
 * sessão.
 */
router.get('/me', async (req, res) => {
  const db = req.app.get('db') as Db;
  const id = await ensureAppUser(db, { clerkUserId: usuarioDaSessao(res) });
  const [linha] = await db.select().from(appUser).where(eq(appUser.id, id));
  res.json({ id: linha.id, clerkUserId: linha.clerkUserId });
});

/**
 * Busca um `app_user` por id **dentro do escopo da sessão**.
 *
 * A consulta filtra por `id` **e** por `clerk_user_id` da sessão, como o §1.5
 * exige. Não é "buscar por id e conferir a posse depois": a posse entra na
 * cláusula, então pedir o id de outro usuário simplesmente não casa nada — e
 * responde 404, sem revelar que aquele registro existe.
 */
router.get('/users/:id', async (req, res) => {
  const db = req.app.get('db') as Db;
  await ensureAppUser(db, { clerkUserId: usuarioDaSessao(res) });

  const [linha] = await db
    .select()
    .from(appUser)
    .where(and(eq(appUser.id, req.params.id), eq(appUser.clerkUserId, usuarioDaSessao(res))));

  if (!linha) {
    responderProblema(res, {
      status: 404,
      code: 'recurso_nao_encontrado',
      title: 'Recurso não encontrado',
    });
    return;
  }
  res.json({ id: linha.id, clerkUserId: linha.clerkUserId });
});

export default router;
