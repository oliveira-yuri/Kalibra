import { describe, it } from 'vitest';
import type { FabricaDeDriver } from './driver';
import { CENARIOS } from './cenarios';

/**
 * Roda todos os cenários contra um driver qualquer.
 *
 * **Um mundo por cenário**, criado pela fábrica: se um cenário pudesse ver o que o
 * anterior deixou, o conjunto passaria a depender da ordem — e ordem é exatamente
 * o que não sobrevive à troca de adaptador.
 *
 * O `finally` existe para que um cenário que falha ainda desmonte o mundo. Sem ele,
 * a primeira falha vazaria árvores React para os cenários seguintes, e a saída
 * mostraria uma cascata de erros derivados em cima do erro real.
 */
export function rodarContrato(nome: string, fabrica: FabricaDeDriver): void {
  describe(`contrato: ${nome}`, () => {
    for (const cenario of CENARIOS) {
      it(cenario.nome, async () => {
        const mundo = await fabrica();
        try {
          await cenario.roda(mundo.driver);
        } finally {
          await mundo.encerrar();
        }
      });
    }
  });
}
