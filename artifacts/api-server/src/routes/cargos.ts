import { Router, type IRouter, type Request, type Response } from 'express';
import { and, eq, ne } from 'drizzle-orm';
import { workspace, cargo, type Db } from '@workspace/db';
import { CreateCargoBody, PatchCargoBody, GetWorkspaceResponse } from '@workspace/api-zod';
import { requireAuth, usuarioDaSessao } from '../middlewares/require-auth';
import { ensureAppUser } from '../lib/ensure-app-user';
import { responderProblema } from '../lib/problem';
import { paraCorpoDeWorkspace } from '../lib/workspace-dto';
import { ehViolacaoDeUnicidade } from './workspaces';

/**
 * Cargos, aninhados sob o workspace.
 *
 * **A posse do WORKSPACE é o que autoriza mexer no cargo.** Um cargo não tem dono
 * próprio: ele pertence ao workspace, e o workspace ao usuário. Por isso toda
 * rota aqui começa localizando o workspace por `slug + user_id` — cargo de
 * workspace alheio responde 404 pelo mesmo motivo que o workspace responde.
 *
 * As três respostas devolvem **o workspace inteiro**, não o cargo. A seleção e a
 * `version` mudam junto, e devolver só o cargo obrigaria o cliente a uma segunda
 * leitura para saber o que ficou verdadeiro.
 */
const router: IRouter = Router();

router.use(requireAuth);

function paraDia(valor: Date | string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor;
  return valor.toISOString().slice(0, 10);
}

function validarSaida<T>(schema: { parse(v: unknown): unknown }, corpo: T): T {
  schema.parse(corpo);
  return corpo;
}

function naoEncontrado(res: Response): void {
  responderProblema(res, {
    status: 404,
    code: 'workspace_nao_encontrado',
    title: 'Workspace não encontrado',
  });
}

/** Localiza o workspace do usuário da sessão, ou `null`. */
async function doUsuario(req: Request, res: Response, slug: string) {
  const db = req.app.get('db') as Db;
  const userId = await ensureAppUser(db, { clerkUserId: usuarioDaSessao(res) });
  const [linha] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.slug, slug), eq(workspace.userId, userId)));
  return linha ? { db, linha } : null;
}

/** Relê e devolve o workspace inteiro, já com a `version` nova. */
async function responderComWorkspace(db: Db, workspaceId: string, res: Response, status = 200) {
  const [linha] = await db.select().from(workspace).where(eq(workspace.id, workspaceId));
  const cargos = await db.select().from(cargo).where(eq(cargo.workspaceId, workspaceId));
  res.status(status).json(validarSaida(GetWorkspaceResponse, paraCorpoDeWorkspace(linha, cargos)));
}

/** Toda escrita relevante incrementa a versão do workspace, na mesma transação. */
async function incrementarVersao(tx: Db, workspaceId: string, versaoAtual: number) {
  await tx
    .update(workspace)
    .set({ version: versaoAtual + 1, updatedAt: new Date() })
    .where(eq(workspace.id, workspaceId));
}

router.post('/workspaces/:slug/cargos', async (req, res) => {
  const analise = CreateCargoBody.safeParse(req.body);
  if (!analise.success) {
    responderProblema(res, { status: 400, code: 'corpo_invalido', title: 'Corpo da requisição inválido' });
    return;
  }

  const achado = await doUsuario(req, res, req.params.slug);
  if (!achado) { naoEncontrado(res); return; }
  const { db, linha } = achado;

  try {
    await db.transaction(async (tx) => {
    const existentes = await tx.select().from(cargo).where(eq(cargo.workspaceId, linha.id));
    await tx.insert(cargo).values({
      workspaceId: linha.id,
      // Ver a nota em `workspaces.ts`: o id do cargo é identidade de domínio, e
      // o cliente pode escolhê-la na criação. Sem ela, o servidor gera um rótulo
      // livre — `c<n>` a partir de quantos já existem.
      id: analise.data.id ?? `c${existentes.length + 1}`,
      name: analise.data.name,
      examDate: paraDia(analise.data.examDate),
      period: analise.data.period ?? null,
      position: existentes.length,
      // O primeiro cargo de um workspace nasce selecionado; os seguintes, não. A
      // interface sempre mostra um cargo, e um workspace sem seleção não tem tela.
      isSelected: existentes.length === 0,
    });
    await incrementarVersao(tx as unknown as Db, linha.id, linha.version);
    });
  } catch (erro) {
    // Traduzido da violação da PK composta, não previsto por um `select` antes —
    // que teria janela entre a consulta e a escrita.
    if (ehViolacaoDeUnicidade(erro)) {
      responderProblema(res, {
        status: 409,
        code: 'cargo_id_em_uso',
        title: 'Este workspace já tem um cargo com esse identificador',
      });
      return;
    }
    throw erro;
  }

  await responderComWorkspace(db, linha.id, res, 201);
});

router.patch('/workspaces/:slug/cargos/:cargoId', async (req, res) => {
  const analise = PatchCargoBody.safeParse(req.body);
  if (!analise.success) {
    responderProblema(res, { status: 400, code: 'corpo_invalido', title: 'Corpo da requisição inválido' });
    return;
  }

  const achado = await doUsuario(req, res, req.params.slug);
  if (!achado) { naoEncontrado(res); return; }
  const { db, linha } = achado;
  const alteracoes = analise.data;

  const [alvo] = await db
    .select()
    .from(cargo)
    .where(and(eq(cargo.id, req.params.cargoId), eq(cargo.workspaceId, linha.id)));
  if (!alvo) { naoEncontrado(res); return; }

  await db.transaction(async (tx) => {
    if (alteracoes.isSelected === true) {
      // **Desmarcar os outros vem ANTES, na mesma transação.** O índice único
      // parcial da Fase 2 recusa dois selecionados no mesmo workspace, e o
      // servidor não pode depender de tentar e falhar: a ordem é desmarcar,
      // depois marcar.
      await tx
        .update(cargo)
        .set({ isSelected: false })
        .where(and(eq(cargo.workspaceId, linha.id), ne(cargo.id, alvo.id)));
    }

    await tx
      .update(cargo)
      .set({
        ...(alteracoes.name !== undefined && { name: alteracoes.name }),
        ...(alteracoes.examDate !== undefined && { examDate: paraDia(alteracoes.examDate) }),
        ...(alteracoes.period !== undefined && { period: alteracoes.period }),
        ...(alteracoes.position !== undefined && { position: alteracoes.position }),
        ...(alteracoes.isSelected !== undefined && { isSelected: alteracoes.isSelected }),
      })
      .where(eq(cargo.id, alvo.id));

    await incrementarVersao(tx as unknown as Db, linha.id, linha.version);
  });

  await responderComWorkspace(db, linha.id, res);
});

router.delete('/workspaces/:slug/cargos/:cargoId', async (req, res) => {
  const achado = await doUsuario(req, res, req.params.slug);
  if (!achado) { naoEncontrado(res); return; }
  const { db, linha } = achado;

  const cargos = await db.select().from(cargo).where(eq(cargo.workspaceId, linha.id));
  const alvo = cargos.find((c) => c.id === req.params.cargoId);
  if (!alvo) { naoEncontrado(res); return; }

  if (cargos.length === 1) {
    // `WorkspaceDraft.cargos` não pode ficar vazio — um array vazio deixaria
    // `selectedCargoId` apontando para nada, que foi a regressão I3 da Fase 1.
    responderProblema(res, {
      status: 409,
      code: 'ultimo_cargo',
      title: 'Um workspace precisa de pelo menos um cargo',
    });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(cargo).where(eq(cargo.id, alvo.id));

    if (alvo.isSelected) {
      // Apagar o selecionado NÃO deixa o workspace sem seleção. Promove o de
      // menor `position` — decisão explícita, porque a alternativa (ficar sem
      // seleção) produziria uma tela que não sabe o que mostrar.
      const restantes = cargos
        .filter((c) => c.id !== alvo.id)
        .sort((a, b) => a.position - b.position);
      await tx.update(cargo).set({ isSelected: true }).where(eq(cargo.id, restantes[0].id));
    }

    await incrementarVersao(tx as unknown as Db, linha.id, linha.version);
  });

  await responderComWorkspace(db, linha.id, res);
});

export default router;
