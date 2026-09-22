import { expect } from 'vitest';
import { emptyAvailability } from '@workspace/core';
import type { WorkspaceDraft } from '../ports';
import type { Driver } from './driver';

/**
 * Os cenários do contrato: o que o usuário fez, e o que o domínio deve dizer
 * depois.
 *
 * **Nenhum deles sabe como o estado é guardado.** Nada de armazenamento do
 * navegador, nada de React, nenhum import de adaptador. A única forma de
 * perguntar ao sistema é pelo `Driver`, e a única forma de afirmar durabilidade é
 * `recarregar()` — parar de olhar e olhar de novo.
 *
 * `estrutura.test.ts` fiscaliza isso varrendo este arquivo em busca dos nomes
 * proibidos. Por isso o parágrafo acima os descreve em vez de citá-los: a guarda
 * é textual e não distingue código de comentário, então escrever aqui o nome que
 * ela procura reprovaria justamente o arquivo que está em conformidade.
 *
 * Eles rodam contra o adaptador local hoje e contra o de API na Fase 5. É por isso
 * que precisam ser escritos ANTES de o backend existir: escritos depois,
 * descreveriam o que o backend faz em vez de o que o domínio promete.
 */

/** Um cenário: o que o usuário fez, e o que o domínio deve dizer depois. */
export type Cenario = { nome: string; roda(d: Driver): Promise<void> };

export function umWorkspace(p: Partial<WorkspaceDraft> = {}): WorkspaceDraft {
  return {
    slug: 'w1',
    title: 'Concurso de teste',
    institution: 'Banca X',
    type: 'Concurso Público',
    examDate: '2027-03-01',
    cargos: [{ id: 'c1', name: 'Cargo A', examDate: '2027-03-01' }],
    selectedCargoId: 'c1',
    availability: emptyAvailability(),
    // O estado inicial de um workspace sem edital importado. `WorkspaceStatus`
    // vive em `lib/core` e é exaustivo por construção — inventar um valor aqui
    // passaria no vitest, que não checa tipos, e só o typecheck pegaria.
    status: 'sem_edital',
    sourceMode: 'none',
    sourceBlocks: [],
    importStatus: 'pending',
    progress: 0,
    nextAction: '',
    active: true,
    ...p,
  };
}

export const CENARIOS: Cenario[] = [
  {
    nome: 'workspace criado sobrevive a recarregar',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-dur', title: 'Título original' }));
      await d.recarregar();

      // Afirma sobre o que ESTE cenário criou, localizado por slug. Contagem
      // total seria contaminada pelos dois workspaces fictícios que o adaptador
      // local devolve quando a chave de armazenamento está ausente — um
      // comportamento de demonstração que nenhum adaptador de API terá.
      const lido = await d.lerWorkspace('w-dur');
      expect(lido?.title).toBe('Título original');
    },
  },
];
