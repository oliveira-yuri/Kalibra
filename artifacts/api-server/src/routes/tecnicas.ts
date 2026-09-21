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
 * **DECISÃO DA TAREFA D2: as duas FICAM, com prazo de validade escrito.**
 *
 * A regra registrada é "tabela sem endpoint é aceitável; código sem chamador não
 * é", e um endpoint cujo único chamador é teste está na fronteira. Ficam porque
 * cada uma é o instrumento de uma guarda que, sem ela, não teria como ser
 * exercitada:
 *
 * - `/me` é a única rota cuja resposta correta é definida **só pela sessão**. É
 *   por isso que ela serve para provar que o cliente não declara quem é: se o
 *   servidor passasse a confiar no corpo ou na query, a resposta mudaria de forma
 *   visível. Contra uma rota que ignorasse o usuário, o teste não veria nada.
 * - `/users/:id` é a única que recebe do cliente o identificador de um recurso.
 *   Sem ela não há vetor de path, não há prova de 404-em-vez-de-403, e a posse na
 *   cláusula `where` fica sem nada que a defenda.
 *
 * **Saem na Fase 5**, no mesmo commit em que `GET /api/workspaces/:id` entrar: aí
 * a guarda de posse passa a ter recurso de domínio de verdade para defender, e os
 * testes de isolamento são reescritos contra ele. Manter as duas depois disso
 * seria a inércia que esta decisão existe para evitar.
 *
 * Que elas fiquem fora do produto não é promessa de comentário: `tecnicas.test.ts`
 * varre o frontend inteiro e falha se alguma tela as chamar.
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
