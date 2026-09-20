import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  WORKSPACE_STATUSES, CONCEPT_STATUSES, CONCEPT_KINDS,
  APPROVAL_TYPES, APPROVAL_STATUSES,
} from '@workspace/core';
import { createTestDb, type TestDb } from '../test/pglite';

/**
 * Forma do schema, verificada CONTRA O BANCO — não contra o código que o gerou.
 *
 * A diferença importa: ler o arquivo de schema provaria só que escrevi o que
 * escrevi. Consultar o catálogo do Postgres depois de aplicar as migrations prova
 * o que de fato existe no banco, e pega o caso em que alguém muda `lib/core` ou o
 * schema e esquece de rodar `drizzle-kit generate` — deixando a migration para
 * trás do código.
 */

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

async function valoresDoEnum(nome: string): Promise<string[]> {
  const { rows } = await db.execute<{ valor: string }>(sql`
    select e.enumlabel as valor
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = ${nome}
    order by e.enumsortorder
  `);
  return rows.map((linha) => linha.valor);
}

describe('anti-deriva: os enums do banco batem com lib/core', () => {
  /**
   * Os cinco enums que pertencem ao contrato compartilhado — os que `lib/core`
   * declara e o banco materializa.
   *
   * `source_mode` NÃO está aqui, de propósito: é `text` no banco, e seus valores
   * vivem hoje em `artifacts/kalibra/src/domain/ports`. `lib/db` não pode importar
   * da aplicação — seria inverter a dependência, uma lib passando a depender de um
   * app. Promover `SourceMode` para `lib/core` e transformá-lo em `pgEnum` é
   * trabalho da fase que migra o módulo de workspaces, onde o contrato da API
   * precisa desses valores de qualquer forma. Registrado no documento de
   * verificação.
   */
  const CASOS: ReadonlyArray<[string, readonly string[]]> = [
    ['workspace_status', WORKSPACE_STATUSES],
    ['concept_status', CONCEPT_STATUSES],
    ['concept_kind', CONCEPT_KINDS],
    ['approval_type', APPROVAL_TYPES],
    ['approval_status', APPROVAL_STATUSES],
  ];

  it.each(CASOS)('%s tem exatamente os valores de lib/core', async (nomeNoBanco, deLibCore) => {
    const noBanco = await valoresDoEnum(nomeNoBanco);
    expect(noBanco.length).toBeGreaterThan(0);
    expect([...noBanco].sort()).toEqual([...deLibCore].sort());
  });

  it('os cinco enums existem no banco — a lista de casos não pode silenciosamente encolher', async () => {
    const { rows } = await db.execute<{ n: number }>(sql`
      select count(distinct t.typname)::int as n
      from pg_type t join pg_enum e on e.enumtypid = t.oid
    `);
    expect(rows[0].n).toBe(CASOS.length);
  });
});

describe('forma: nenhuma coluna de tempo sem fuso', () => {
  /**
   * A Fase 1A perdeu uma rodada para uma contagem regressiva que andava um dia
   * para trás porque `new Date('2026-06-01')` é meia-noite UTC. `timestamp` sem
   * fuso é a mesma armadilha com a mesma cara, e uma coluna errada só apareceria
   * meses depois, como dado torto que ninguém liga ao schema.
   *
   * `date` fica fora: é uma data de calendário (dia da prova), sem hora — não tem
   * fuso a perder.
   */
  it('toda coluna timestamp é "with time zone"', async () => {
    const { rows } = await db.execute<{ tabela: string; coluna: string; tipo: string }>(sql`
      select table_name as tabela, column_name as coluna, data_type as tipo
      from information_schema.columns
      where table_schema = 'public' and data_type like 'timestamp%'
      order by table_name, column_name
    `);

    // Se a consulta não achar coluna nenhuma, o teste passaria sem verificar nada.
    expect(rows.length).toBeGreaterThan(0);

    const semFuso = rows.filter((c) => c.tipo !== 'timestamp with time zone');
    expect(semFuso.map((c) => `${c.tabela}.${c.coluna}: ${c.tipo}`)).toEqual([]);
  });
});
