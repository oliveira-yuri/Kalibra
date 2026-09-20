import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb, resetTables, type TestDb } from '../test/pglite';
import {
  appUser, workspace, cargo, editalSourceBlock,
  concept, syllabusItem, syllabusItemCargo, approvalItem,
} from './index';

/**
 * Os testes de integridade das oito tabelas.
 *
 * Todos exercitam o BANCO, não código de aplicação: o que se prova aqui é que o
 * Postgres recusa o estado inválido mesmo quando quem escreve insiste. É o que
 * sustenta a §1.2 — "o servidor valida como autoridade" — no nível de baixo.
 *
 * Cada constraint aqui é provada load-bearing na Tarefa E2: removida do schema, o
 * teste correspondente fica vermelho.
 */

let db: TestDb;

/** Dois usuários distintos, para os testes de escopo cruzado. */
async function doisUsuarios() {
  const [a] = await db.insert(appUser).values({ clerkUserId: 'clerk_a' }).returning();
  const [b] = await db.insert(appUser).values({ clerkUserId: 'clerk_b' }).returning();
  return { a, b };
}

async function criarWorkspace(userId: string, slug: string) {
  const [w] = await db.insert(workspace).values({
    userId, slug, title: slug, status: 'sem_edital',
    availability: { days: [], maxSessionMinutes: 50 },
  }).returning();
  return w;
}

async function criarConceito(userId: string, slug: string, parentId?: string) {
  const [c] = await db.insert(concept).values({
    userId, canonicalName: slug, slug, kind: 'topico', status: 'provisional', parentId,
  }).returning();
  return c;
}

beforeAll(async () => { db = await createTestDb(); });
beforeEach(async () => { await resetTables(db); });

describe('app_user', () => {
  it('recusa dois registros com o mesmo clerk_user_id', async () => {
    await db.insert(appUser).values({ clerkUserId: 'clerk_x' });
    await expect(db.insert(appUser).values({ clerkUserId: 'clerk_x' })).rejects.toThrow();
  });
});

describe('workspace — slug é único POR USUÁRIO, não globalmente', () => {
  it('dois usuários podem ter o mesmo slug', async () => {
    const { a, b } = await doisUsuarios();
    await criarWorkspace(a.id, 'setec-campinas');
    await expect(criarWorkspace(b.id, 'setec-campinas')).resolves.toBeDefined();
  });

  it('o MESMO usuário não pode ter dois workspaces com o mesmo slug', async () => {
    const { a } = await doisUsuarios();
    await criarWorkspace(a.id, 'setec-campinas');
    await expect(criarWorkspace(a.id, 'setec-campinas')).rejects.toThrow();
  });
});

describe('cargo — no máximo um selecionado por workspace', () => {
  it('recusa dois cargos selecionados no MESMO workspace', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    await db.insert(cargo).values({ workspaceId: w.id, name: 'Analista', isSelected: true });
    await expect(
      db.insert(cargo).values({ workspaceId: w.id, name: 'Técnico', isSelected: true }),
    ).rejects.toThrow();
  });

  it('aceita um selecionado em CADA workspace — o índice é parcial por workspace', async () => {
    const { a } = await doisUsuarios();
    const w1 = await criarWorkspace(a.id, 'w1');
    const w2 = await criarWorkspace(a.id, 'w2');
    await db.insert(cargo).values({ workspaceId: w1.id, name: 'Analista', isSelected: true });
    await expect(
      db.insert(cargo).values({ workspaceId: w2.id, name: 'Analista', isSelected: true }),
    ).resolves.toBeDefined();
  });

  it('aceita vários NÃO selecionados no mesmo workspace — o índice só vale onde is_selected', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    await db.insert(cargo).values({ workspaceId: w.id, name: 'Analista' });
    await expect(
      db.insert(cargo).values({ workspaceId: w.id, name: 'Técnico' }),
    ).resolves.toBeDefined();
  });
});

describe('escopo composto — a FK prova que os dois lados pertencem ao mesmo escopo', () => {
  it('conceito NÃO pode ter pai de outro usuário', async () => {
    const { a, b } = await doisUsuarios();
    const paiDeB = await criarConceito(b.id, 'pai');
    await expect(criarConceito(a.id, 'filho', paiDeB.id)).rejects.toThrow();
  });

  it('conceito-raiz é aceito — MATCH SIMPLE não verifica FK com coluna nula', async () => {
    const { a } = await doisUsuarios();
    await expect(criarConceito(a.id, 'raiz')).resolves.toBeDefined();
  });

  it('item de syllabus NÃO pode ter pai de outro workspace', async () => {
    const { a } = await doisUsuarios();
    const w1 = await criarWorkspace(a.id, 'w1');
    const w2 = await criarWorkspace(a.id, 'w2');
    const c = await criarConceito(a.id, 'c');
    const [paiEmW2] = await db.insert(syllabusItem).values({
      workspaceId: w2.id, conceptId: c.id, sourceLabel: 'Pai',
    }).returning();

    await expect(db.insert(syllabusItem).values({
      workspaceId: w1.id, conceptId: c.id, sourceLabel: 'Filho', parentItemId: paiEmW2.id,
    })).rejects.toThrow();
  });

  it('bloco NÃO pode apontar para cargo de outro workspace', async () => {
    const { a } = await doisUsuarios();
    const w1 = await criarWorkspace(a.id, 'w1');
    const w2 = await criarWorkspace(a.id, 'w2');
    const [cargoDeW2] = await db.insert(cargo).values({ workspaceId: w2.id, name: 'X' }).returning();

    await expect(db.insert(editalSourceBlock).values({
      workspaceId: w1.id, cargoId: cargoDeW2.id, text: 'conteúdo',
    })).rejects.toThrow();
  });

  it('bloco COMUM (cargo_id nulo) é aceito', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    await expect(db.insert(editalSourceBlock).values({
      workspaceId: w.id, text: 'conteúdo comum',
    })).resolves.toBeDefined();
  });

  it('ligação NÃO pode unir item do workspace A a cargo do workspace B', async () => {
    const { a } = await doisUsuarios();
    const w1 = await criarWorkspace(a.id, 'w1');
    const w2 = await criarWorkspace(a.id, 'w2');
    const c = await criarConceito(a.id, 'c');
    const [item] = await db.insert(syllabusItem).values({
      workspaceId: w1.id, conceptId: c.id, sourceLabel: 'Item',
    }).returning();
    const [cargoDeW2] = await db.insert(cargo).values({ workspaceId: w2.id, name: 'X' }).returning();

    await expect(db.insert(syllabusItemCargo).values({
      workspaceId: w1.id, syllabusItemId: item.id, cargoId: cargoDeW2.id,
    })).rejects.toThrow();
  });

  it('a mesma tripla item+cargo não entra duas vezes', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    const c = await criarConceito(a.id, 'c');
    const [item] = await db.insert(syllabusItem).values({
      workspaceId: w.id, conceptId: c.id, sourceLabel: 'Item',
    }).returning();
    const [cg] = await db.insert(cargo).values({ workspaceId: w.id, name: 'X' }).returning();

    await db.insert(syllabusItemCargo).values({ workspaceId: w.id, syllabusItemId: item.id, cargoId: cg.id });
    await expect(db.insert(syllabusItemCargo).values({
      workspaceId: w.id, syllabusItemId: item.id, cargoId: cg.id,
    })).rejects.toThrow();
  });

  it('aprovação NÃO pode apontar para conceito de outro usuário', async () => {
    const { a, b } = await doisUsuarios();
    const conceitoDeB = await criarConceito(b.id, 'c');
    await expect(db.insert(approvalItem).values({
      userId: a.id, type: 'concept_merge', status: 'pendente',
      title: 'T', targetConceptId: conceitoDeB.id,
    })).rejects.toThrow();
  });

  it('aprovação NÃO pode apontar para workspace de outro usuário', async () => {
    const { a, b } = await doisUsuarios();
    const wDeB = await criarWorkspace(b.id, 'w-de-b');
    await expect(db.insert(approvalItem).values({
      userId: a.id, type: 'edital_structure', status: 'pendente',
      title: 'T', workspaceId: wDeB.id,
    })).rejects.toThrow();
  });

  it('aprovação sem workspace e sem conceito-alvo é aceita', async () => {
    const { a } = await doisUsuarios();
    await expect(db.insert(approvalItem).values({
      userId: a.id, type: 'edital_structure', status: 'pendente', title: 'T',
    })).resolves.toBeDefined();
  });
});

describe('concept — a biblioteca global não aceita duplicado', () => {
  it('recusa dois conceitos com o mesmo slug para o MESMO usuário', async () => {
    const { a } = await doisUsuarios();
    await criarConceito(a.id, 'crase');
    await expect(criarConceito(a.id, 'crase')).rejects.toThrow();
  });

  it('aceita o mesmo slug para usuários DIFERENTES — a biblioteca é por usuário', async () => {
    const { a, b } = await doisUsuarios();
    await criarConceito(a.id, 'crase');
    await expect(criarConceito(b.id, 'crase')).resolves.toBeDefined();
  });
});

describe('cascatas — o que morre junto e o que sobrevive', () => {
  it('apagar workspace apaga cargos, blocos, itens, ligações e aprovações', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    const c = await criarConceito(a.id, 'c');
    const [cg] = await db.insert(cargo).values({ workspaceId: w.id, name: 'X' }).returning();
    const [item] = await db.insert(syllabusItem).values({
      workspaceId: w.id, conceptId: c.id, sourceLabel: 'Item',
    }).returning();
    await db.insert(syllabusItemCargo).values({ workspaceId: w.id, syllabusItemId: item.id, cargoId: cg.id });
    await db.insert(editalSourceBlock).values({ workspaceId: w.id, cargoId: cg.id, text: 't' });
    await db.insert(approvalItem).values({
      userId: a.id, workspaceId: w.id, type: 'edital_structure', status: 'pendente', title: 'T',
    });

    await db.delete(workspace).where(eq(workspace.id, w.id));

    expect(await db.select().from(cargo)).toHaveLength(0);
    expect(await db.select().from(editalSourceBlock)).toHaveLength(0);
    expect(await db.select().from(syllabusItem)).toHaveLength(0);
    expect(await db.select().from(syllabusItemCargo)).toHaveLength(0);
    expect(await db.select().from(approvalItem)).toHaveLength(0);
  });

  it('apagar workspace NÃO apaga conceito nenhum — a biblioteca é reutilizada entre concursos', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    const c = await criarConceito(a.id, 'crase');
    await db.insert(syllabusItem).values({ workspaceId: w.id, conceptId: c.id, sourceLabel: 'Crase' });

    await db.delete(workspace).where(eq(workspace.id, w.id));

    const sobreviventes = await db.select().from(concept);
    expect(sobreviventes).toHaveLength(1);
    expect(sobreviventes[0].slug).toBe('crase');
  });

  it('apagar cargo apaga suas ligações, mas NÃO o item que ainda pertence a outro cargo', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    const c = await criarConceito(a.id, 'c');
    const [item] = await db.insert(syllabusItem).values({
      workspaceId: w.id, conceptId: c.id, sourceLabel: 'Comum',
    }).returning();
    const [c1] = await db.insert(cargo).values({ workspaceId: w.id, name: 'Analista' }).returning();
    const [c2] = await db.insert(cargo).values({ workspaceId: w.id, name: 'Técnico' }).returning();
    await db.insert(syllabusItemCargo).values([
      { workspaceId: w.id, syllabusItemId: item.id, cargoId: c1.id },
      { workspaceId: w.id, syllabusItemId: item.id, cargoId: c2.id },
    ]);

    await db.delete(cargo).where(eq(cargo.id, c1.id));

    expect(await db.select().from(syllabusItem)).toHaveLength(1);
    const ligacoes = await db.select().from(syllabusItemCargo);
    expect(ligacoes).toHaveLength(1);
    expect(ligacoes[0].cargoId).toBe(c2.id);
  });

  it('apagar o cargo selecionado não deixa seleção pendurada', async () => {
    const { a } = await doisUsuarios();
    const w = await criarWorkspace(a.id, 'w1');
    const [cg] = await db.insert(cargo).values({
      workspaceId: w.id, name: 'Analista', isSelected: true,
    }).returning();

    await db.delete(cargo).where(eq(cargo.id, cg.id));

    const { rows } = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from cargo where is_selected
    `);
    expect(rows[0].n).toBe(0);
  });
});
