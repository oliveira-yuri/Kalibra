import { Router, type IRouter, type Request, type Response } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { workspace, cargo, type Db } from '@workspace/db';
import { initialStatus, slugify, emptyAvailability, validateAvailability } from '@workspace/core';
import type { WeeklyAvailability, DayAvailability } from '@workspace/core';
import {
  CreateWorkspaceBody,
  PatchWorkspaceBody,
  GetWorkspaceResponse,
  ListWorkspacesResponse,
} from '@workspace/api-zod';
import { requireAuth, usuarioDaSessao } from '../middlewares/require-auth';
import { ensureAppUser } from '../lib/ensure-app-user';
import { responderProblema } from '../lib/problem';
import { conferirPrecondicao } from '../lib/if-match';
import { paraCorpoDeWorkspace } from '../lib/workspace-dto';

/**
 * Workspaces — o primeiro recurso de domínio da API.
 *
 * **Toda consulta filtra por `user_id` na cláusula `where`.** Buscar por slug e
 * conferir a posse depois, em código, é proibido pelo §1.5: o registro de outro
 * usuário simplesmente não casa, e a resposta é **404, nunca 403** — um 403
 * confirmaria que aquele slug existe para alguém.
 *
 * Nenhuma regra de domínio nasce aqui. `slugify`, `initialStatus` e
 * `emptyAvailability` vêm de `lib/core`; a unicidade de slug vem do banco; os
 * derivados da resposta vêm de `workspace-dto`.
 */
/**
 * `Date` do Zod gerado → `YYYY-MM-DD` da coluna `date`.
 *
 * O `orval.config.ts` liga `useDates`, então `format: date` chega aqui como
 * `Date`. A coluna `date` do Postgres guarda só o dia, e o driver espera string.
 * Sem esta conversão o insert falha em tempo de tipo — que é o certo: a costura
 * existe, e escondê-la com um cast faria a data virar um instante UTC e andar um
 * dia para quem estiver a oeste de Greenwich.
 */
function paraDia(valor: Date | string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor;
  return valor.toISOString().slice(0, 10);
}

/**
 * Valida a saída e devolve **o objeto original**, não o analisado.
 *
 * `parse` devolveria os campos de data já convertidos em `Date`, e `res.json` os
 * serializaria como instante ISO — `2027-03-01T00:00:00.000Z` em vez de
 * `2027-03-01`, contrariando o `format: date` do próprio contrato que se está
 * validando. Aqui o schema serve para CONFERIR, não para transformar.
 */
function validarSaida<T>(schema: { parse(v: unknown): unknown }, corpo: T): T {
  schema.parse(corpo);
  return corpo;
}

/**
 * Estreita o que o Zod validou para o tipo do domínio.
 *
 * O contrato diz `minimum: 0, maximum: 6`, que o Zod confere em runtime mas tipa
 * como `number`. `lib/core` tipa o dia da semana como união literal `0|…|6`. As
 * duas descrições concordam; só o TypeScript não consegue ver isso sozinho.
 *
 * Um cast fecharia o buraco sem olhar. Aqui a verificação é feita de novo — é
 * barato — e, com a forma garantida, **a validação de domínio vem de `lib/core`**
 * (`validateAvailability`), como a restrição da fase exige: o Zod diz "é um número
 * entre 0 e 6"; `lib/core` diz se a disponibilidade faz sentido.
 */
function paraDisponibilidade(entrada: unknown): WeeklyAvailability | null {
  if (typeof entrada !== 'object' || entrada === null) return null;
  const bruto = entrada as { days?: unknown; maxSessionMinutes?: unknown };
  if (!Array.isArray(bruto.days) || typeof bruto.maxSessionMinutes !== 'number') return null;

  const days: DayAvailability[] = [];
  for (const dia of bruto.days) {
    if (typeof dia !== 'object' || dia === null) return null;
    const { weekday, minutes } = dia as { weekday?: unknown; minutes?: unknown };
    if (typeof weekday !== 'number' || typeof minutes !== 'number') return null;
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
    days.push({ weekday: weekday as DayAvailability['weekday'], minutes });
  }

  const disponibilidade: WeeklyAvailability = { days, maxSessionMinutes: bruto.maxSessionMinutes };
  return validateAvailability(disponibilidade).length === 0 ? disponibilidade : null;
}

const router: IRouter = Router();

router.use(requireAuth);

/**
 * Os campos que o servidor computa. Recebê-los do cliente é erro, não ruído.
 *
 * `progress` entrou na lista depois de o harness de contrato mostrar que ele
 * passava DESPERCEBIDO: não estando no schema de escrita, o Zod o descartava em
 * silêncio como chave desconhecida. Descartar e recusar parecem iguais do lado do
 * servidor e são opostos do lado do cliente — um deixa quem chamou acreditando
 * que escreveu.
 */
const DERIVADOS = ['nextAction', 'selectedCargoId', 'importStatus', 'version', 'progress'] as const;

/**
 * Recusa campo derivado **antes** de validar a forma.
 *
 * Ignorar em silêncio seria pior que recusar: o cliente mandaria `version: 7`,
 * receberia 200, e acreditaria ter escrito algo que o servidor descartou. Um erro
 * explícito transforma um mal-entendido silencioso em bug de integração visível
 * na primeira execução.
 */
function recusarDerivados(req: Request, res: Response): boolean {
  const corpo = req.body as Record<string, unknown> | undefined;
  if (!corpo) return false;

  const presentes = DERIVADOS.filter((campo) => campo in corpo);
  if (presentes.length === 0) return false;

  responderProblema(res, {
    status: 400,
    code: 'campo_derivado',
    title: `Campo computado pelo servidor não pode ser enviado: ${presentes.join(', ')}`,
  });
  return true;
}

/** O id interno do usuário da sessão, criando a linha na primeira visita. */
async function idDoUsuario(req: Request, res: Response): Promise<{ db: Db; userId: string }> {
  const db = req.app.get('db') as Db;
  const userId = await ensureAppUser(db, { clerkUserId: usuarioDaSessao(res) });
  return { db, userId };
}

async function lerWorkspaceComCargos(db: Db, userId: string, slug: string) {
  const [linha] = await db
    .select()
    .from(workspace)
    // Posse NA CLÁUSULA. Não é "buscar e conferir depois".
    .where(and(eq(workspace.slug, slug), eq(workspace.userId, userId)));

  if (!linha) return null;

  const cargos = await db.select().from(cargo).where(eq(cargo.workspaceId, linha.id));
  return { linha, cargos };
}

function naoEncontrado(res: Response): void {
  responderProblema(res, {
    status: 404,
    code: 'workspace_nao_encontrado',
    title: 'Workspace não encontrado',
  });
}

router.get('/workspaces', async (req, res) => {
  const { db, userId } = await idDoUsuario(req, res);

  const linhas = await db.select().from(workspace).where(eq(workspace.userId, userId));
  const todosOsCargos = linhas.length
    ? await db.select().from(cargo)
    : [];

  const corpo = linhas.map((linha) =>
    paraCorpoDeWorkspace(linha, todosOsCargos.filter((c) => c.workspaceId === linha.id)),
  );

  // Validar a SAÍDA com o mesmo schema que o cliente usa faz divergência entre
  // spec e implementação virar erro aqui, não bug de dado na tela.
  res.json(validarSaida(ListWorkspacesResponse, corpo));
});

router.get('/workspaces/:slug', async (req, res) => {
  const { db, userId } = await idDoUsuario(req, res);

  const achado = await lerWorkspaceComCargos(db, userId, req.params.slug);
  if (!achado) { naoEncontrado(res); return; }

  res.json(validarSaida(GetWorkspaceResponse, paraCorpoDeWorkspace(achado.linha, achado.cargos)));
});

router.post('/workspaces', async (req, res) => {
  if (recusarDerivados(req, res)) return;

  const analise = CreateWorkspaceBody.safeParse(req.body);
  if (!analise.success) {
    responderProblema(res, {
      status: 400,
      code: 'corpo_invalido',
      title: 'Corpo da requisição inválido',
    });
    return;
  }
  const entrada = analise.data;
  const { db, userId } = await idDoUsuario(req, res);

  const disponibilidade = entrada.availability === undefined
    ? emptyAvailability()
    : paraDisponibilidade(entrada.availability);
  if (disponibilidade === null) {
    responderProblema(res, {
      status: 400,
      code: 'disponibilidade_invalida',
      title: 'Disponibilidade semanal inválida',
    });
    return;
  }

  const slug = entrada.slug?.trim() || slugify(entrada.title);
  const temEdital = (entrada.sourceMode ?? 'none') !== 'none';

  try {
    const criado = await db.transaction(async (tx) => {
      const [linha] = await tx
        .insert(workspace)
        .values({
          userId,
          slug,
          title: entrada.title,
          institution: entrada.institution ?? '',
          type: entrada.type ?? 'Concurso Público',
          examDate: paraDia(entrada.examDate),
          availability: disponibilidade,
          // O status inicial é decisão de `lib/core`, nunca do corpo da
          // requisição — `WorkspaceCreate` sequer aceita `status`.
          status: initialStatus(temEdital),
          sourceMode: entrada.sourceMode ?? 'none',
          sourceFileName: entrada.sourceFileName ?? null,
        })
        .returning();

      const pedidos = entrada.cargos ?? [];
      const cargos = pedidos.length
        ? await tx.insert(cargo).values(pedidos.map((c, i) => ({
          workspaceId: linha.id,
          // O id vem do cliente quando ele manda. É identidade de DOMÍNIO
          // compartilhada — `syllabus_item_cargo` a referencia, e o módulo de
          // syllabus só migra na Fase 8 — então trocá-la por um valor do servidor
          // quebraria uma referência real entre módulos.
          //
          // Única dentro do WORKSPACE, não globalmente: a PK é o par
          // `(workspace_id, id)`, e dois concursos têm cada um o seu `c1`.
          id: c.id ?? `c${i + 1}`,
          name: c.name,
          examDate: paraDia(c.examDate),
          period: c.period ?? null,
          position: i,
          // O primeiro nasce selecionado: a interface sempre mostra um cargo, e
          // um workspace sem seleção não tem tela.
          isSelected: i === 0,
        }))).returning()
        : [];

      return paraCorpoDeWorkspace(linha, cargos);
    });

    res.status(201).json(validarSaida(GetWorkspaceResponse, criado));
  } catch (erro) {
    // O 409 é TRADUZIDO da violação de `unique(user_id, slug)`, não previsto por
    // um `select` antes de inserir. Um `select` teria uma janela entre a consulta
    // e a escrita em que outra requisição insere o mesmo slug — e aí a segunda
    // quebraria com 500 em vez de 409.
    if (ehViolacaoDeUnicidade(erro)) {
      responderProblema(res, {
        status: 409,
        code: 'slug_em_uso',
        title: 'Você já tem um workspace com esse endereço',
      });
      return;
    }
    throw erro;
  }
});

router.patch('/workspaces/:slug', async (req, res) => {
  if (recusarDerivados(req, res)) return;

  const analise = PatchWorkspaceBody.safeParse(req.body);
  if (!analise.success) {
    responderProblema(res, {
      status: 400,
      code: 'corpo_invalido',
      title: 'Corpo da requisição inválido',
    });
    return;
  }

  const alteracoes = analise.data;
  const disponibilidade = alteracoes.availability === undefined
    ? null
    : paraDisponibilidade(alteracoes.availability);
  if (alteracoes.availability !== undefined && disponibilidade === null) {
    responderProblema(res, {
      status: 400,
      code: 'disponibilidade_invalida',
      title: 'Disponibilidade semanal inválida',
    });
    return;
  }

  const { db, userId } = await idDoUsuario(req, res);

  const achado = await lerWorkspaceComCargos(db, userId, req.params.slug);
  if (!achado) { naoEncontrado(res); return; }

  const precondicao = conferirPrecondicao(req, res, achado.linha.version);
  if (!precondicao.ok) return;

  const atualizado = await db.transaction(async (tx) => {
    const [linha] = await tx
      .update(workspace)
      .set({
        // Campo a campo, e não espalhando `analise.data`: o espalhamento
        // carregaria a disponibilidade com o tipo frouxo do Zod, e faria qualquer
        // campo novo do schema entrar na escrita sem ninguém decidir por isso.
        ...(alteracoes.title !== undefined && { title: alteracoes.title }),
        ...(alteracoes.institution !== undefined && { institution: alteracoes.institution }),
        ...(alteracoes.type !== undefined && { type: alteracoes.type }),
        ...(alteracoes.examDate !== undefined && { examDate: paraDia(alteracoes.examDate) }),
        ...(disponibilidade !== null && { availability: disponibilidade }),
        ...(alteracoes.status !== undefined && { status: alteracoes.status }),
        ...(alteracoes.sourceMode !== undefined && { sourceMode: alteracoes.sourceMode }),
        ...(alteracoes.sourceFileName !== undefined && { sourceFileName: alteracoes.sourceFileName }),
        ...(alteracoes.active !== undefined && { active: alteracoes.active }),
        updatedAt: new Date(),
        // **O incremento vai na MESMA instrução da escrita.** Fazê-lo depois, num
        // segundo `update`, reabriria exatamente a janela que o If-Match existe
        // para fechar.
        version: sql`${workspace.version} + 1`,
      })
      .where(and(
        eq(workspace.id, achado.linha.id),
        eq(workspace.userId, userId),
        // A comparação de versão entra no WHERE, e não só num `if` antes: entre
        // ler e escrever cabe outra requisição, e só o banco decide isso sem
        // janela.
        //
        // **Esta linha NÃO está provada load-bearing, e é honesto dizer.** Removê-la
        // deixa a suíte inteira verde, inclusive o teste de duas requisições
        // concorrentes: contra PGlite — conexão única, embutida — as requisições
        // serializam, então a conferência em código sempre chega primeiro. Não há
        // entrelaçamento a produzir.
        //
        // Fica porque é correta e custa nada, e porque o regime em que ela importa
        // é justamente o que PGlite não tem: pool, conexões simultâneas, duas
        // requisições de verdade no mesmo instante. Isso está na lista do que exige
        // Postgres real, e é lá que ela será exercitada.
        eq(workspace.version, precondicao.versaoLida),
      ))
      .returning();

    return linha;
  });

  if (!atualizado) {
    responderProblema(res, {
      status: 412,
      code: 'precondition_failed',
      title: 'A versão enviada não é a atual',
    });
    return;
  }

  const cargos = await db.select().from(cargo).where(eq(cargo.workspaceId, atualizado.id));
  res.json(validarSaida(GetWorkspaceResponse, paraCorpoDeWorkspace(atualizado, cargos)));
});

/**
 * Reconhece a violação de unicidade do Postgres (`23505`) sem depender da
 * mensagem, que é texto localizável e muda entre versões.
 */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const causa = 'cause' in erro ? (erro as { cause?: unknown }).cause : undefined;
  for (const candidato of [erro, causa]) {
    if (typeof candidato === 'object' && candidato !== null && 'code' in candidato) {
      if ((candidato as { code?: unknown }).code === '23505') return true;
    }
  }
  return false;
}

export default router;
