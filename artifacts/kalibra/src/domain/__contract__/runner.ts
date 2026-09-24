import { describe, it } from 'vitest';
import type { FabricaDeDriver } from './driver';
import { CENARIOS, type Cenario, type Modulo } from './cenarios';

/**
 * Quais cenários um driver com estes módulos consegue rodar.
 *
 * Exportada porque **a guarda precisa computar o mesmo conjunto por fora** e
 * comparar com o que de fato rodou. Se o filtro morasse só dentro do runner, a
 * guarda estaria conferindo o filtro contra ele mesmo.
 */
export function cenariosPara(modulos: readonly Modulo[]): Cenario[] {
  const disponiveis = new Set(modulos);
  return CENARIOS.filter((c) => c.modulos.every((m) => disponiveis.has(m)));
}

/** Os nomes dos cenários que a última chamada a `rodarContrato` de fato registrou. */
const registrados = new Map<string, string[]>();

export function cenariosRegistrados(nome: string): string[] {
  return registrados.get(nome) ?? [];
}

/**
 * Roda os cenários contra um driver qualquer.
 *
 * **Um mundo por cenário**, criado pela fábrica: se um cenário pudesse ver o que o
 * anterior deixou, o conjunto passaria a depender da ordem — e ordem é exatamente
 * o que não sobrevive à troca de adaptador.
 *
 * `modulos` diz o que aquele driver oferece. Omitir roda tudo, que é o caso do
 * adaptador local. Um driver de API roda só o que já migrou — e o que ele pula
 * **não desaparece em silêncio**: `estrutura.test.ts` confere que o conjunto
 * rodado é exatamente o derivável dos módulos declarados.
 */
export function rodarContrato(
  nome: string,
  fabrica: FabricaDeDriver,
  modulos?: readonly Modulo[],
): void {
  const aRodar = modulos === undefined ? CENARIOS : cenariosPara(modulos);
  registrados.set(nome, aRodar.map((c) => c.nome));

  describe(`contrato: ${nome}`, () => {
    for (const cenario of aRodar) {
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
