import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { hasEdital } from '@workspace/core';
import {
  migrateWorkspace, getWorkspaces, saveWorkspaces, useWorkspaces, type WorkspaceDraft, defaultCargo,
  nextSyllabusVersionFor,
} from './workspaces';

const ANTIGO = {
  slug: 'setec-campinas',
  title: 'Concurso SETEC Campinas',
  type: 'Concurso Público',
  institution: 'SETEC',
  examDate: '2026-01-17',
  cargos: [{ id: 'c1', name: 'Analista Técnico (Informática)', examDate: '2027-01-17', period: 'A' }],
  selectedCargoId: 'c1',
  progress: 47.2,
  nextAction: 'Resolver 8 questões de porcentagem',
  active: true,
  sourceMode: 'text',
  importStatus: 'completed',
};

describe('migração de workspace', () => {
  it('preserva os campos que já existiam', () => {
    const migrado = migrateWorkspace(ANTIGO);
    expect(migrado?.slug).toBe('setec-campinas');
    expect(migrado?.title).toBe('Concurso SETEC Campinas');
    expect(migrado?.institution).toBe('SETEC');
    expect(migrado?.cargos).toHaveLength(1);
    expect(migrado?.selectedCargoId).toBe('c1');
  });

  it('traduz importStatus completed para diagnostico_pendente (o diagnóstico ainda não rodou)', () => {
    // O único caminho até 'estudando' passa por diagnostico_pendente →
    // diagnostico_em_andamento → plano_quinzenal_pendente (lib/core/src/workspace/status.ts).
    // 'completed' aqui só significa que a extração do edital terminou — nunca que o
    // diagnóstico inicial já rodou — então o mapeamento correto é diagnostico_pendente.
    expect(migrateWorkspace(ANTIGO)?.status).toBe('diagnostico_pendente');
  });

  it('traduz importStatus pending para aguardando revisão', () => {
    expect(migrateWorkspace({ ...ANTIGO, importStatus: 'pending' })?.status).toBe('aguardando_revisao_edital');
  });

  it('traduz importStatus error para erro', () => {
    expect(migrateWorkspace({ ...ANTIGO, importStatus: 'error' })?.status).toBe('erro');
  });

  it('dá disponibilidade vazia a quem não tinha', () => {
    const migrado = migrateWorkspace(ANTIGO);
    expect(migrado?.availability.days).toHaveLength(7);
    expect(migrado?.availability.maxSessionMinutes).toBe(50);
  });

  it('deriva hasEdital do status migrado, sem heurística própria', () => {
    expect(hasEdital(migrateWorkspace(ANTIGO)!.status)).toBe(true);

    // Antes desta refatoração este mesmo registro (sem sourceMode, importStatus
    // 'pending') produzia ao mesmo tempo status='aguardando_revisao_edital' (que
    // implica edital) e hasEdital=false — a divergência entre os dois campos que esta
    // tarefa elimina ao tornar `status` a única fonte de verdade.
    const semSourceMode = migrateWorkspace({ ...ANTIGO, sourceMode: undefined, importStatus: 'pending' })!;
    expect(semSourceMode.status).toBe('aguardando_revisao_edital');
    expect(hasEdital(semSourceMode.status)).toBe(true);
  });

  it('descarta hasEdital de registros antigos', () => {
    const migrado = migrateWorkspace({ ...ANTIGO, hasEdital: true });
    expect(migrado).not.toHaveProperty('hasEdital');
  });

  it('registro antigo com hasEdital false e sem edital vira sem_edital', () => {
    const migrado = migrateWorkspace({
      ...ANTIGO, hasEdital: false, importStatus: 'pending',
      sourceText: undefined, sourceFileName: undefined,
    });
    expect(migrado?.status).toBe('sem_edital');
  });

  it('dá um cargo padrão a quem não tinha nenhum', () => {
    const migrado = migrateWorkspace({ ...ANTIGO, cargos: undefined, selectedCargoId: undefined });
    expect(migrado?.cargos).toHaveLength(1);
    expect(migrado?.cargos[0].name).toBe('Cargo único');
    expect(migrado?.selectedCargoId).toBe(migrado?.cargos[0].id);
  });

  it('não altera um registro já no formato novo', () => {
    const novo = migrateWorkspace(ANTIGO)!;
    expect(migrateWorkspace(novo)).toEqual(novo);
  });

  it('devolve null para lixo', () => {
    expect(migrateWorkspace(null)).toBeNull();
    expect(migrateWorkspace({})).toBeNull();
    expect(migrateWorkspace({ slug: 'x' })).toBeNull();
    expect(migrateWorkspace('string')).toBeNull();
  });

  describe('cargos malformados (não pode lançar)', () => {
    it('descarta um cargo null e cai no cargo padrão', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, cargos: [null], selectedCargoId: undefined });
      expect(migrado).not.toBeNull();
      expect(migrado?.cargos).toHaveLength(1);
      expect(migrado?.cargos[0].name).toBe('Cargo único');
      expect(migrado?.selectedCargoId).toBe(migrado?.cargos[0].id);
    });

    it('descarta um cargo que é uma string e cai no cargo padrão', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, cargos: ['string'], selectedCargoId: undefined });
      expect(migrado).not.toBeNull();
      expect(migrado?.cargos).toHaveLength(1);
      expect(migrado?.cargos[0].name).toBe('Cargo único');
    });

    it('descarta um cargo vazio ({}) e cai no cargo padrão', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, cargos: [{}], selectedCargoId: undefined });
      expect(migrado).not.toBeNull();
      expect(migrado?.cargos).toHaveLength(1);
      expect(migrado?.cargos[0].name).toBe('Cargo único');
    });

    it('num array misto, mantém só o cargo bem formado e descarta o inválido', () => {
      const bom = { id: 'c9', name: 'Cargo Válido', examDate: '2027-01-17' };
      const migrado = migrateWorkspace({ ...ANTIGO, cargos: [bom, null], selectedCargoId: 'c9' });
      expect(migrado).not.toBeNull();
      expect(migrado?.cargos).toHaveLength(1);
      expect(migrado?.cargos[0]).toEqual(bom);
      expect(migrado?.selectedCargoId).toBe('c9');
    });

    it('nunca lança para nenhuma combinação de cargo malformado', () => {
      for (const cargos of [[null], ['string'], [{}], [undefined], [42], [null, null]]) {
        expect(() => migrateWorkspace({ ...ANTIGO, cargos, selectedCargoId: undefined })).not.toThrow();
      }
    });
  });

  describe('validação de forma (availability, status, importStatus, sourceMode)', () => {
    it('rejeita availability sem o formato esperado e usa a vazia', () => {
      expect(migrateWorkspace({ ...ANTIGO, availability: [] })?.availability.days).toHaveLength(7);
      expect(migrateWorkspace({ ...ANTIGO, availability: {} })?.availability.days).toHaveLength(7);
      expect(migrateWorkspace({ ...ANTIGO, availability: { days: 'não é array', maxSessionMinutes: 50 } })
        ?.availability.days).toHaveLength(7);
      expect(migrateWorkspace({ ...ANTIGO, availability: { days: [], maxSessionMinutes: 'cinquenta' } })
        ?.availability.days).toHaveLength(7);
      expect(migrateWorkspace({ ...ANTIGO, availability: 'lixo' })?.availability.maxSessionMinutes).toBe(50);
    });

    it('aceita uma availability válida sem alterá-la', () => {
      const availability = { days: [{ weekday: 1, minutes: 30 }], maxSessionMinutes: 30 };
      expect(migrateWorkspace({ ...ANTIGO, availability })?.availability).toEqual(availability);
    });

    it('rejeita status desconhecido e deriva de importStatus', () => {
      expect(migrateWorkspace({ ...ANTIGO, status: 'inventado' })?.status).toBe('diagnostico_pendente');
      expect(migrateWorkspace({ ...ANTIGO, status: 42 })?.status).toBe('diagnostico_pendente');
    });

    it('rejeita importStatus desconhecido e cai em pending', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, importStatus: 'inventado', status: undefined });
      expect(migrado?.importStatus).toBe('pending');
      expect(migrado?.status).toBe('aguardando_revisao_edital');
    });

    it('rejeita sourceMode desconhecido e cai em text', () => {
      expect(migrateWorkspace({ ...ANTIGO, sourceMode: 'fax' })?.sourceMode).toBe('text');
      expect(migrateWorkspace({ ...ANTIGO, sourceMode: 123 })?.sourceMode).toBe('text');
    });
  });

  describe('hasEdital — ramos não cobertos antes', () => {
    it('marca hasEdital true para parsing mesmo sem sourceText/sourceFileName', () => {
      const migrado = migrateWorkspace({
        ...ANTIGO,
        importStatus: 'parsing',
        sourceText: undefined,
        sourceFileName: undefined,
      });
      expect(hasEdital(migrado!.status)).toBe(true);
    });

    it('marca hasEdital true para error mesmo sem sourceText/sourceFileName', () => {
      const migrado = migrateWorkspace({
        ...ANTIGO,
        importStatus: 'error',
        sourceText: undefined,
        sourceFileName: undefined,
      });
      expect(hasEdital(migrado!.status)).toBe(true);
    });

    it('mantém hasEdital: false explícito mesmo com sourceText presente (idempotência)', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, hasEdital: false, sourceText: 'algum texto' });
      expect(hasEdital(migrado!.status)).toBe(false);
    });
  });

  describe('campos não-string (regressão I5 — o helper `str` precisa pegar mais que null/undefined)', () => {
    // `(raw.x as string) ?? fallback` só filtra null/undefined: um número ou objeto salvo
    // no lugar de uma string passava direto, tipado como `string` sem nunca ter sido
    // validado. `nextAction` é renderizado direto por Portal.tsx — um objeto ali faz o
    // React lançar "Objects are not valid as a React child" fora do try/catch que isola
    // registros corrompidos em getWorkspaces.
    it('cai no fallback quando nextAction é um objeto, não uma string', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, nextAction: { texto: 'não deveria estar aqui' } });
      expect(migrado?.nextAction).toBe('');
    });

    it('cai no fallback quando institution é um número', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, institution: 42 });
      expect(migrado?.institution).toBe('');
    });

    it('cai no fallback quando type é um array', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, type: ['Concurso Público'] });
      expect(migrado?.type).toBe('Concurso Público');
    });

    it('cai no fallback (o id do primeiro cargo) quando selectedCargoId não é uma string', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, selectedCargoId: 123 });
      expect(migrado?.selectedCargoId).toBe(migrado?.cargos[0].id);
    });

    it('cai em undefined quando sourceFileName ou sourceText não são strings', () => {
      const migrado = migrateWorkspace({ ...ANTIGO, sourceFileName: 999, sourceText: { texto: 'x' } });
      expect(migrado?.sourceFileName).toBeUndefined();
      expect(migrado?.sourceText).toBeUndefined();
    });

    it('nunca lança para nenhum campo de texto malformado', () => {
      expect(() => migrateWorkspace({
        ...ANTIGO,
        institution: 1,
        type: {},
        examDate: [],
        selectedCargoId: null,
        nextAction: () => 'função não é dado',
      })).not.toThrow();
    });
  });
});

describe('defaultCargo — regressão I3 (fonte única do cargo sintético)', () => {
  it('gera um único cargo chamado "Cargo único" com a data informada', () => {
    expect(defaultCargo('2027-05-10')).toEqual({ id: 'c1', name: 'Cargo único', examDate: '2027-05-10' });
  });

  it('migrateWorkspace usa exatamente o mesmo formato para o cargo padrão', () => {
    const migrado = migrateWorkspace({ ...ANTIGO, cargos: undefined, selectedCargoId: undefined });
    expect(migrado?.cargos[0]).toEqual(defaultCargo(ANTIGO.examDate));
  });
});

describe('getWorkspaces — um registro corrompido não pode derrubar os outros', () => {
  const KEY = 'kalibra_workspaces:anonymous';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('mantém os workspaces válidos quando um registro é lixo irreconhecível', () => {
    localStorage.setItem(KEY, JSON.stringify([ANTIGO, { lixo: true }, { ...ANTIGO, slug: 'outro' }]));
    const workspaces = getWorkspaces();
    expect(workspaces.map((w) => w.slug)).toEqual(['setec-campinas', 'outro']);
  });

  it('mantém os workspaces válidos mesmo se um registro tiver cargos malformados', () => {
    const comCargoRuim = { ...ANTIGO, slug: 'com-cargo-ruim', cargos: [null], selectedCargoId: undefined };
    localStorage.setItem(KEY, JSON.stringify([ANTIGO, comCargoRuim]));
    const workspaces = getWorkspaces();
    expect(workspaces).toHaveLength(2);
    expect(workspaces.find((w) => w.slug === 'com-cargo-ruim')?.cargos[0].name).toBe('Cargo único');
  });

  it('nunca lança e nunca descarta os bons por causa de um item corrompido', () => {
    localStorage.setItem(KEY, JSON.stringify([ANTIGO, null, 'string', 42, { cargos: [null] }]));
    expect(() => getWorkspaces()).not.toThrow();
    const workspaces = getWorkspaces();
    expect(workspaces.map((w) => w.slug)).toEqual(['setec-campinas']);
  });
});

describe('getWorkspaces — achado I6 da revisão final: corrupção não pode ressuscitar a demonstração', () => {
  const KEY = 'kalibra_workspaces:anonymous';

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('chave GENUINAMENTE ausente semeia a demonstração (primeiro uso de verdade)', () => {
    expect(localStorage.getItem(KEY)).toBeNull();
    const workspaces = getWorkspaces();
    expect(workspaces.map((w) => w.slug)).toEqual(['setec-campinas', 'bb-escriturario']);
  });

  it('JSON corrompido devolve lista VAZIA, nunca a demonstração — a corrupção não pode se passar por primeiro uso', () => {
    localStorage.setItem(KEY, 'isto não é json{{{');
    const workspaces = getWorkspaces();
    expect(workspaces).toEqual([]);
  });

  it('valor salvo que não é um array (ex.: um objeto solto) também devolve lista vazia, não a demonstração', () => {
    localStorage.setItem(KEY, JSON.stringify({ isto: 'não é uma lista' }));
    const workspaces = getWorkspaces();
    expect(workspaces).toEqual([]);
  });

  it('a corrupção detectada não sobrescreve nada sozinha — uma leitura pura não grava', () => {
    localStorage.setItem(KEY, 'lixo{{{');
    getWorkspaces();
    // getWorkspaces() é só leitura — o valor corrompido original continua lá, disponível
    // para qualquer tentativa de recuperação manual, em vez de já ter sido substituído.
    expect(localStorage.getItem(KEY)).toBe('lixo{{{');
  });

  it('um array corrompido cujo conteúdo ainda é reconhecível continua sendo recuperado item a item (comportamento pré-existente, não regressão)', () => {
    localStorage.setItem(KEY, JSON.stringify([ANTIGO]));
    expect(getWorkspaces().map((w) => w.slug)).toEqual(['setec-campinas']);
  });
});

describe('nextSyllabusVersionFor — achados C1 (fix wave anterior) e R1/R2 (re-revisão)', () => {
  const APPROVALS_KEY = 'kalibra_approvals:anonymous';
  const syllabusKey = (slug: string) => `kalibra_syllabus:anonymous:${slug}`;

  const structureItem = (id: string, slug: string, version: number, status: string) => ({
    id, workspaceId: slug, type: 'edital_structure', status,
    title: '', rationale: '', sourceRef: null, targetConceptId: null, confidence: null,
    payloadBefore: null, payloadAfter: { version: String(version) },
    createdAt: '2026-09-14T00:00:00.000Z', decidedAt: null, reason: null,
  });

  const seedApprovals = (items: unknown[]) => localStorage.setItem(APPROVALS_KEY, JSON.stringify(items));
  const seedProgramme = (slug: string) => localStorage.setItem(syllabusKey(slug), JSON.stringify({
    items: [{ id: 'i1', workspaceId: slug, conceptId: 'c', parentItemId: null, sourceLabel: 'Matéria', sourceExcerpt: null, page: null, confidence: 1, uncertain: false }],
    links: [],
  }));

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('workspace que nunca teve nada: a primeira importação é a versão 1', () => {
    expect(nextSyllabusVersionFor('novo-concurso')).toBe(1);
  });

  it('achado R1: um workspace que JÁ TEM programa salvo nunca volta a apurar 1', () => {
    // O contador do fix wave anterior devolvia 1 aqui (nenhuma chave gravada ainda), e
    // a tela de reimportação escondia a comparação do PD-08 inteira por causa disso.
    seedProgramme('setec-campinas');
    expect(nextSyllabusVersionFor('setec-campinas')).toBe(2);
  });

  it('achado C1: uma tentativa abandonada JÁ NA FILA continua nomeando o número dela — a próxima apura outro', () => {
    seedProgramme('setec-campinas');
    seedApprovals([structureItem('a1', 'setec-campinas', 2, 'pendente')]);
    expect(nextSyllabusVersionFor('setec-campinas')).toBe(3);
  });

  it('achado C1: vale também para um workspace que ainda nem existe (a chave é o slug)', () => {
    seedApprovals([structureItem('a1', 'novo-concurso', 1, 'pendente')]);
    expect(nextSyllabusVersionFor('novo-concurso')).toBe(2);
  });

  it('achado R2: uma tentativa abandonada ANTES de virar proposta na fila não queima número nenhum', () => {
    // O usuário começa uma importação e desiste antes de a tela de revisão enfileirar
    // a proposta: nada, em lugar nenhum, nomeia aquele número. O contador durável do
    // fix wave anterior incrementava assim mesmo, e a tentativa seguinte caía na versão
    // 2 — que a tela anunciava como "COMPARADO COM A VERSÃO 1", para um workspace que
    // nunca teve versão 1.
    expect(nextSyllabusVersionFor('novo-concurso')).toBe(1);
    expect(nextSyllabusVersionFor('novo-concurso')).toBe(1);
    expect(nextSyllabusVersionFor('novo-concurso')).toBe(1);
  });

  it('itens decididos também continuam nomeando a versão deles', () => {
    seedApprovals([
      structureItem('a1', 'setec-campinas', 1, 'aprovado'),
      structureItem('a2', 'setec-campinas', 2, 'rejeitado'),
    ]);
    expect(nextSyllabusVersionFor('setec-campinas')).toBe(3);
  });

  it('itens de OUTRO workspace não contam', () => {
    seedApprovals([structureItem('a1', 'outro-concurso', 7, 'pendente')]);
    expect(nextSyllabusVersionFor('setec-campinas')).toBe(1);
  });

  it('é namespaced por usuário, como as outras chaves', () => {
    localStorage.setItem('kalibra_approvals:user-1', JSON.stringify([structureItem('a1', 'setec-campinas', 4, 'pendente')]));
    expect(nextSyllabusVersionFor('setec-campinas', 'user-1')).toBe(5);
    expect(nextSyllabusVersionFor('setec-campinas', 'user-2')).toBe(1);
  });
});

describe('saveWorkspaces — achado R6 da re-revisão (a primeira escrita não pode destruir o original ilegível)', () => {
  const KEY = 'kalibra_workspaces:anonymous';
  const BACKUP = 'kalibra_workspaces:anonymous:corrompido';
  // Um registro RECUPERÁVEL: JSON válido, com o dado real do usuário dentro, só na
  // forma errada (objeto indexado em vez de array) — exatamente o que `getWorkspaces`
  // trata como corrupção e devolve `[]`.
  const ORIGINAL = JSON.stringify({ '0': { slug: 'meu-concurso', title: 'Concurso real do usuário', cargos: [] } });

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('o valor ilegível é preservado byte a byte numa chave de backup antes de ser sobrescrito', () => {
    localStorage.setItem(KEY, ORIGINAL);
    expect(getWorkspaces()).toEqual([]);

    saveWorkspaces([]);

    expect(localStorage.getItem(BACKUP)).toBe(ORIGINAL);
  });

  it('JSON inválido também é preservado', () => {
    localStorage.setItem(KEY, 'lixo{{{ que ainda pode ter dado do usuário');
    saveWorkspaces([]);
    expect(localStorage.getItem(BACKUP)).toBe('lixo{{{ que ainda pode ter dado do usuário');
  });

  it('uma segunda corrupção nunca enterra o backup da primeira', () => {
    localStorage.setItem(KEY, ORIGINAL);
    saveWorkspaces([]);
    localStorage.setItem(KEY, 'corrupção posterior');
    saveWorkspaces([]);
    expect(localStorage.getItem(BACKUP)).toBe(ORIGINAL);
  });

  it('um valor legível nunca gera backup (nenhum lixo em armazenamento no caminho normal)', () => {
    localStorage.setItem(KEY, JSON.stringify([]));
    saveWorkspaces([]);
    expect(localStorage.getItem(BACKUP)).toBeNull();
  });
});

describe('useWorkspaces — duas escritas síncronas no mesmo tick sobrevivem ambas (achado C, fix round 2)', () => {
  // Sem nada salvo, getWorkspaces() cai nos dois programas de demonstração
  // (setec-campinas, bb-escriturario) — comportamento intencional de
  // useWorkspaces, não relacionado a este achado. Semear um array vazio
  // evita esse ruído e deixa o teste focado só na escrita em lote.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kalibra_workspaces:anonymous', JSON.stringify([]));
  });
  afterEach(() => localStorage.clear());

  const workspace = (slug: string): WorkspaceDraft => ({
    slug,
    title: slug,
    institution: '',
    type: 'Concurso Público',
    examDate: '2027-01-01',
    cargos: [defaultCargo('2027-01-01')],
    selectedCargoId: 'c1',
    availability: { days: [], maxSessionMinutes: 50 },
    status: 'sem_edital',
    sourceMode: 'text',
    importStatus: 'pending',
    progress: 0,
    nextAction: '',
    active: true,
  });

  it('duas chamadas de addWorkspace dentro do mesmo act() persistem os dois workspaces', () => {
    const { result } = renderHook(() => useWorkspaces());

    act(() => {
      result.current.addWorkspace(workspace('a'));
      result.current.addWorkspace(workspace('b'));
    });

    expect(result.current.workspaces.map((w) => w.slug)).toEqual(['a', 'b']);
    expect(getWorkspaces().map((w) => w.slug)).toEqual(['a', 'b']);
  });

  it('addWorkspace seguido de updateWorkspace no mesmo tick não perde a atualização', () => {
    const { result } = renderHook(() => useWorkspaces());

    act(() => {
      result.current.addWorkspace(workspace('a'));
      result.current.updateWorkspace('a', { progress: 42 });
    });

    expect(result.current.workspaces.find((w) => w.slug === 'a')?.progress).toBe(42);
    expect(getWorkspaces().find((w) => w.slug === 'a')?.progress).toBe(42);
  });
});
