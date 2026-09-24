/**
 * @vitest-environment node
 *
 * Este arquivo sobe um servidor de verdade sobre PGlite, e PGlite precisa do Node
 * — sob jsdom ele falha ao migrar, porque o `fetch` simulado do navegador não
 * entrega `arrayBuffer`. O resto do pacote continua em jsdom; só este arquivo sai.
 */
import { rodarContrato } from './runner';
import { criarDriverApi, MODULOS_MIGRADOS } from './api-driver';

/**
 * O contrato contra a API real.
 *
 * Curto pelo mesmo motivo que `local.test.ts` é curto: tudo que ele sabe é qual
 * driver usar e quais módulos aquele driver oferece. Os cenários não mudaram uma
 * linha para rodar aqui — se tivessem mudado, não seriam contrato.
 *
 * **É este arquivo que dá sentido à Fase 4.** Até ele existir, os cenários só
 * podiam provar que eram executáveis. A partir daqui, um cenário que passe no
 * local e falhe aqui significa que os dois lados discordam sobre o domínio, e a
 * discordância aparece como vermelho em vez de bug de dado meses depois.
 */
rodarContrato('adaptador de API', criarDriverApi, MODULOS_MIGRADOS);

import { describe, it, expect } from 'vitest';
import { cenariosPara, cenariosRegistrados } from './runner';
import { CENARIOS } from './cenarios';

describe('o que rodou contra a API', () => {
  it('é exatamente o derivável dos módulos migrados — nem um a menos', () => {
    // Aqui, e não em `estrutura.test.ts`: o registro do runner é por grafo de
    // módulos, e cada arquivo do vitest tem o seu. Lá a conferência seria sobre um
    // registro vazio, e passaria sem verificar nada.
    const esperados = cenariosPara(MODULOS_MIGRADOS).map((c) => c.nome);
    expect(esperados.length).toBeGreaterThan(0);
    expect(new Set(cenariosRegistrados('adaptador de API'))).toEqual(new Set(esperados));
  });

  it('e é um subconjunto próprio — a migração ainda não terminou', () => {
    // Quando esta asserção ficar vermelha, todos os módulos terão migrado e o
    // mecanismo de subconjunto terá deixado de ser necessário.
    expect(cenariosRegistrados('adaptador de API').length).toBeLessThan(CENARIOS.length);
  });
});
