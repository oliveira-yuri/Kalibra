import { nextActionFor, importStatusFor } from '@workspace/core';
import type { workspace as workspaceTable, cargo as cargoTable } from '@workspace/db';

type LinhaDeWorkspace = typeof workspaceTable.$inferSelect;
type LinhaDeCargo = typeof cargoTable.$inferSelect;

/**
 * Traduz o que está no banco para o corpo que a API devolve.
 *
 * **Função pura, e é de propósito.** Não recebe `db`, não consulta nada: quem
 * consultou passa as linhas. Assim o teste dos derivados não precisa de banco, e o
 * DTO não pode ganhar uma consulta escondida com o tempo.
 *
 * Três campos da resposta **não existem no banco** e são computados aqui (§2.8):
 *
 * - `nextAction` — função pura do status. `nextActionFor` vive em `lib/core`;
 *   escrever a tabela de novo aqui criaria a segunda representação que a Fase 2
 *   eliminou, e ela divergiria na primeira vez que alguém acrescentasse um status.
 * - `selectedCargoId` — derivado de `cargo.is_selected`. A seleção é propriedade
 *   do cargo: guardá-la no workspace criaria dependência circular entre as duas
 *   tabelas, que foi o motivo de a Fase 2 resolver por índice único parcial.
 * - `importStatus` — leitura mais grossa do status, por `importStatusFor`, o
 *   mesmo mapa que o adaptador local usa.
 *
 * **`progress` não entra.** A Fase 2 o removeu por não haver dado real de estudo
 * para computá-lo. Devolver `0` aqui pareceria medição e não é; quando a tela
 * precisar de um valor para um workspace sem diagnóstico, quem escolhe esse valor
 * é a tela, e a escolha fica visível no diff dela.
 */
export function paraCorpoDeWorkspace(
  linha: LinhaDeWorkspace,
  cargos: readonly LinhaDeCargo[],
) {
  const selecionado = cargos.find((c) => c.isSelected);

  return {
    slug: linha.slug,
    title: linha.title,
    institution: linha.institution,
    type: linha.type,
    examDate: linha.examDate,
    cargos: [...cargos]
      // Ordem explícita: o cliente não deve depender da ordem que o banco
      // devolveu, e o banco não promete nenhuma sem `order by`.
      .sort((a, b) => a.position - b.position)
      .map(paraCorpoDeCargo),
    selectedCargoId: selecionado?.id ?? null,
    availability: linha.availability,
    status: linha.status,
    sourceMode: linha.sourceMode,
    sourceFileName: linha.sourceFileName,
    active: linha.active,
    version: linha.version,
    nextAction: nextActionFor(linha.status),
    importStatus: importStatusFor(linha.status),
  };
}

export function paraCorpoDeCargo(linha: LinhaDeCargo) {
  return {
    id: linha.id,
    name: linha.name,
    examDate: linha.examDate,
    period: linha.period,
    position: linha.position,
  };
}
