import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AQUI = __dirname;
const PORTAS = join(AQUI, '..', 'ports');

describe('o Driver é derivado das portas, não do adaptador', () => {
  const DRIVER = readFileSync(join(AQUI, 'driver.ts'), 'utf8');

  it('driver.ts não importa nada de adapters/', () => {
    expect(DRIVER).not.toMatch(/from\s+['"][^'"]*adapters\//);
  });

  it('todo tipo de domínio do Driver vem de @workspace/core ou de ../ports', () => {
    // Se um tipo entrasse aqui vindo de outro lugar, o contrato passaria a ter
    // vocabulário próprio — e "os dois adaptadores implementam o mesmo contrato"
    // deixaria de ser verificável.
    const origens = [...DRIVER.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(origens.length).toBeGreaterThan(0);
    expect(origens.filter((o) => o !== '@workspace/core' && o !== '../ports')).toEqual([]);
  });

  it('cada operação do Driver corresponde a uma operação de porta', () => {
    // A tautologia que este teste impede: o Driver ganhar um método que nenhuma
    // porta tem, e o "contrato" passar a descrever o harness em vez do domínio.
    //
    // **É guarda ESTRUTURAL, não prova semântica.** Ela garante que o Driver não
    // ganha vocabulário próprio; não garante que `renomearItem` signifique a mesma
    // coisa dos dois lados — uma correspondência textual não tem como saber isso.
    // A prova semântica são os cenários, e só quando rodarem contra os dois
    // adaptadores, o que acontece na Fase 5.
    const portas = ['workspaces', 'concepts', 'syllabus', 'approvals']
      .map((nome) => readFileSync(join(PORTAS, `${nome}.ts`), 'utf8'))
      .join('\n');

    // `recarregar` é do harness, não do domínio: é a primitiva de observação.
    const DO_HARNESS = new Set(['recarregar']);
    const metodos = [...DRIVER.matchAll(/^ {2}(\w+)\(/gm)]
      .map((m) => m[1])
      .filter((nome) => !DO_HARNESS.has(nome));

    expect(metodos.length).toBeGreaterThan(15);

    const CORRESPONDENCIA: Record<string, string> = {
      criarWorkspace: 'addWorkspace',
      atualizarWorkspace: 'updateWorkspace',
      lerWorkspace: 'workspaces',
      cargoPadrao: 'defaultCargo',
      proximaVersaoDeEdital: 'nextSyllabusVersionFor',
      lerSyllabus: 'syllabus',
      salvarSyllabus: 'save',
      adicionarItem: 'addItem',
      renomearItem: 'renameItem',
      removerItem: 'removeItem',
      ligarACargo: 'linkToCargo',
      desligarDeCargo: 'unlinkFromCargo',
      separarDeCargo: 'splitFromCargo',
      atualizarLigacao: 'updateLink',
      preverExtracao: 'previewExtraction',
      lerConceitos: 'concepts',
      adicionarConceito: 'addConcept',
      confirmarConceito: 'confirmConcept',
      renomearConceito: 'renameConcept',
      lerAprovacoes: 'items',
      enfileirar: 'enqueue',
      aprovar: 'approve',
      rejeitar: 'reject',
    };

    const semPorta = metodos.filter((metodo) => {
      const alvo = CORRESPONDENCIA[metodo];
      return !alvo || !portas.includes(alvo);
    });
    expect(semPorta).toEqual([]);
  });
});

/**
 * As proibições que mantêm os cenários portáveis.
 *
 * **É esta parte que decide se a Fase 4 valeu.** Sem ela, nada impede a Fase 5 de
 * "consertar" um cenário que quebrou contra a API colando nele uma suposição do
 * adaptador local — e aí o harness deixa de comparar dois adaptadores e passa a
 * descrever um deles.
 *
 * A varredura é textual e não distingue código de comentário. É uma limitação
 * real, e o preço dela é que o cabeçalho de `cenarios.ts` descreve os nomes
 * proibidos em vez de citá-los. Vale pagar: uma guarda que entendesse comentário
 * precisaria de um parser, e um parser com defeito falha em silêncio, que é pior
 * que um falso positivo barulhento.
 */
describe('nenhum cenário conhece o adaptador', () => {
  const FONTE = readFileSync(join(AQUI, 'cenarios.ts'), 'utf8');

  it('a varredura tem o que varrer', () => {
    // Sem isto, um caminho errado faria todas as proibições passarem varrendo um
    // arquivo vazio — verdes e sem verificar nada.
    expect(FONTE.length).toBeGreaterThan(2000);
    expect(FONTE).toContain('CENARIOS');
  });

  it.each([
    ['armazenamento do navegador', /localStorage|sessionStorage/],
    ['objeto window', /\bwindow\./],
    ['evento de janela', /dispatchEvent|addEventListener/],
    ['montagem de hook', /renderHook/],
    ['act do testing-library', /\bact\(/],
    ['import de adaptador', /from\s+['"][^'"]*adapters\//],
    ['chave de armazenamento', /kalibra[_:]/],
  ])('cenarios.ts não menciona %s', (_nome, agulha) => {
    expect(FONTE).not.toMatch(agulha);
  });

  it('nenhum cenário indexa array por posição', () => {
    // Indexar afirma ordem sem dizer que afirma, e ordem é a primeira coisa que
    // muda quando a leitura passa a vir de um `select` sem `order by`.
    //
    // A primeira versão desta guarda era fraca: casava `.items[0]` mas não
    // `portugues[0]` — a forma que os cenários de fato usavam. Filtrar antes não
    // salva: um array de tamanho 1 hoje é um array de tamanho 2 amanhã, e a
    // indexação continuaria verde afirmando sobre o primeiro de dois.
    const indexacoes = [...FONTE.matchAll(/\[\s*\d+\s*\]/g)].map((m) => m[0]);
    expect(indexacoes).toEqual([]);
  });

  it('os cenários usam o caminho autorizado no lugar da indexação', () => {
    // Sem isto, a proibição acima ficaria verde num arquivo que simplesmente
    // parou de verificar unicidade. Proibir sem exigir a saída empurra para a
    // asserção mais fraca, não para a mais forte.
    expect(FONTE).toMatch(/\bunico\(/);
  });

  it('nenhum cenário afirma contagem total', () => {
    // `toHaveLength` sobre uma leitura inteira é a contagem que o adaptador local
    // contamina com seus dois workspaces de demonstração. O caminho autorizado é
    // comparar conjuntos de ids, que ainda pega troca de registro — coisa que
    // tamanho igual deixaria passar.
    expect(FONTE).not.toMatch(/toHaveLength/);
  });
});
