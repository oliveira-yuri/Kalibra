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
