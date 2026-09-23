import { expect } from 'vitest';
import { emptyAvailability } from '@workspace/core';
import type { ApprovalItem, ExtractionOutput, Syllabus } from '@workspace/core';
import type { WorkspaceDraft } from '../ports';
import type { Driver } from './driver';
import { unico, ids, idsDeItens } from './auxiliares';

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


/** Dois cargos — o arranjo mínimo para qualquer cenário sobre deduplicação ou separação. */
export function doisCargos() {
  return [
    { id: 'c1', name: 'Cargo A', examDate: '2027-03-01' },
    { id: 'c2', name: 'Cargo B', examDate: '2027-03-01' },
  ];
}

export function umaExtracao(p: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    entries: [
      {
        cargoId: 'c1', label: 'Português', parentLabel: null, weight: 2,
        questionCount: 10, sourceExcerpt: '1. Português', page: 1, confidence: 0.9,
      },
      {
        cargoId: 'c1', label: 'Crase', parentLabel: 'Português', weight: null,
        questionCount: null, sourceExcerpt: '1.1 Crase', page: 1, confidence: 0.9,
      },
    ],
    detectedCargos: ['Cargo A'],
    examFormat: null,
    examDurationMinutes: null,
    uncertainties: [],
    ...p,
  };
}

/** O que `enfileirar` recebe: a proposta, antes de a fila lhe dar id e status. */
type Proposta = Omit<ApprovalItem, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'reason'>;

export function umaProposta(p: Partial<Proposta> = {}): Proposta {
  return {
    workspaceId: null,
    type: 'edital_structure',
    title: 'Incluir tópico X',
    rationale: 'Apareceu no edital',
    // Proveniência: de ONDE a proposta veio. Nunca o que a decisão muta — isso é
    // `targetConceptId`, e trocar os dois falha em silêncio.
    sourceRef: 'linha 12',
    targetConceptId: null,
    confidence: 0.8,
    payloadBefore: null,
    payloadAfter: null,
    ...p,
  };
}

/** Cargos ligados a um item, ORDENADOS — para a asserção não depender da ordem interna. */
function cargosDe(s: Syllabus, itemId: string): string[] {
  return s.links.filter((l) => l.syllabusItemId === itemId).map((l) => l.cargoId).sort();
}

/**
 * Monta o arranjo mínimo e devolve o que o cenário precisa nomear.
 *
 * O contador é determinístico: um identificador aleatório daria um slug diferente
 * a cada execução, e uma falha de contrato que não reproduz é exatamente a que vai
 * custar caro de depurar quando o driver de API existir.
 *
 * Pode ser um contador de módulo porque cada cenário roda num mundo próprio — não
 * há como dois cenários disputarem o mesmo slug.
 */
let proximoArranjo = 0;

async function umSyllabusComUmItem(
  d: Driver,
  cargoIds: string[] = ['c1'],
): Promise<{ slug: string; itemId: string }> {
  const slug = `w-syl-${++proximoArranjo}`;
  await d.criarWorkspace(umWorkspace({ slug, cargos: doisCargos(), selectedCargoId: 'c1' }));
  await d.adicionarItem(slug, null, 'Tópico base', cargoIds);
  await d.recarregar();

  const s = await d.lerSyllabus(slug);
  // O `unico` falha alto se o arranjo não produziu exatamente um item. Um arranjo
  // que falha em silêncio faria o cenário afirmar sobre `undefined` e passar por
  // vacuidade.
  const item = unico(
    s.items.filter((i) => i.sourceLabel === 'Tópico base'),
    `itens do arranjo em ${slug}`,
  );
  return { slug, itemId: item.id };
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

  // ------------------------------------------------------------------
  // Workspace e cargos
  // ------------------------------------------------------------------
  {
    nome: 'atualizar um workspace não cria outro',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-upd', title: 'Antes' }));
      await d.atualizarWorkspace('w-upd', { title: 'Depois' });
      await d.recarregar();
      expect((await d.lerWorkspace('w-upd'))?.title).toBe('Depois');
    },
  },
  {
    nome: 'atualizar um workspace não afeta outro',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-a', title: 'A' }));
      await d.criarWorkspace(umWorkspace({ slug: 'w-b', title: 'B' }));
      await d.atualizarWorkspace('w-a', { title: 'A editado' });
      await d.recarregar();

      expect((await d.lerWorkspace('w-a'))?.title).toBe('A editado');
      // A segunda asserção é o que dá sentido à primeira: sem ela, uma
      // implementação que sobrescrevesse todos os workspaces passaria.
      expect((await d.lerWorkspace('w-b'))?.title).toBe('B');
    },
  },
  {
    nome: 'trocar o cargo selecionado persiste, e os dois cargos continuam existindo',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({
        slug: 'w-cargo', cargos: doisCargos(), selectedCargoId: 'c1',
      }));
      await d.atualizarWorkspace('w-cargo', { selectedCargoId: 'c2' });
      await d.recarregar();

      const w = await d.lerWorkspace('w-cargo');
      expect(w?.selectedCargoId).toBe('c2');
      // Selecionar não é apagar. Conjunto, não posição: a ordem de `cargos` não é
      // contrato, e afirmá-la quebraria contra uma leitura sem ordenação explícita.
      expect(new Set((w?.cargos ?? []).map((c) => c.id))).toEqual(new Set(['c1', 'c2']));
    },
  },
  {
    nome: 'o cargo padrão tem a data da prova pedida',
    async roda(d) {
      const padrao = await d.cargoPadrao('2027-09-09');
      expect(padrao.examDate).toBe('2027-09-09');
      // Afirma FORMA, não o texto: "Cargo único" é escolha de produto do adaptador
      // local, e outro adaptador poderia nomear diferente sem quebrar contrato.
      expect(padrao.id).toBeTruthy();
      expect(padrao.name).toBeTruthy();
    },
  },

  // ------------------------------------------------------------------
  // Edital e a previsão que não grava
  // ------------------------------------------------------------------
  {
    nome: 'prever a extração NÃO grava nada',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-prev' }));
      const antesSyllabus = await d.lerSyllabus('w-prev');
      const antesConceitos = await d.lerConceitos();
      const antesAprovacoes = await d.lerAprovacoes();

      const proposta = await d.preverExtracao('w-prev', umaExtracao());

      // A proposta existe...
      expect(proposta.syllabus.items.length).toBeGreaterThan(0);

      // ...e nada foi gravado. `recarregar` é o que torna isto uma afirmação sobre
      // o SISTEMA e não sobre memória: se a previsão tivesse gravado, o estado
      // voltaria diferente.
      //
      // Compara CONJUNTOS DE IDS, não contagens. Contagem é a regra que este
      // harness proíbe em toda parte, e é mais fraca por dois motivos: passaria se
      // um registro fosse trocado por outro, e no caso dos conceitos herdaria o
      // problema de o "antes" já não ser vazio.
      await d.recarregar();
      expect(ids(await d.lerConceitos())).toEqual(ids(antesConceitos));
      expect(ids(await d.lerAprovacoes())).toEqual(ids(antesAprovacoes));
      expect(idsDeItens(await d.lerSyllabus('w-prev'))).toEqual(idsDeItens(antesSyllabus));
    },
  },
  {
    nome: 'aplicar a proposta grava o que a previsão mostrou',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-apl' }));
      const proposta = await d.preverExtracao('w-apl', umaExtracao());
      for (const c of proposta.newConcepts) await d.adicionarConceito(c);
      await d.salvarSyllabus('w-apl', proposta.syllabus);
      await d.recarregar();

      // Sem este cenário, o anterior passaria com uma previsão que não computa
      // nada — "não gravou" seria verdade por não ter feito coisa nenhuma.
      const depois = await d.lerSyllabus('w-apl');
      expect(idsDeItens(depois)).toEqual(idsDeItens(proposta.syllabus));
    },
  },
  {
    nome: 'blocos de edital, comum e por cargo, sobrevivem a recarregar',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({
        slug: 'w-blocos',
        cargos: doisCargos(),
        selectedCargoId: 'c1',
        sourceMode: 'text',
        sourceBlocks: [
          { cargoId: null, text: 'Conteúdo comum a todos os cargos' },
          { cargoId: 'c1', text: 'Específico do cargo A' },
        ],
      }));
      await d.recarregar();

      // Mapa por chave, não por posição: a ordem dos blocos não é contrato.
      const blocos = (await d.lerWorkspace('w-blocos'))?.sourceBlocks ?? [];
      const porCargo = new Map(blocos.map((b) => [b.cargoId, b.text]));
      expect(porCargo.get(null)).toContain('comum');
      expect(porCargo.get('c1')).toContain('cargo A');
    },
  },

  // ------------------------------------------------------------------
  // Syllabus
  // ------------------------------------------------------------------
  {
    nome: 'o mesmo tópico em dois cargos vira UM item com DUAS ligações',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({
        slug: 'w-dedup', cargos: doisCargos(), selectedCargoId: 'c1',
      }));
      const proposta = await d.preverExtracao('w-dedup', umaExtracao({
        entries: [
          {
            cargoId: 'c1', label: 'Português', parentLabel: null, weight: null,
            questionCount: null, sourceExcerpt: null, page: null, confidence: 0.9,
          },
          {
            cargoId: 'c2', label: 'Português', parentLabel: null, weight: null,
            questionCount: null, sourceExcerpt: null, page: null, confidence: 0.9,
          },
        ],
      }));
      await d.salvarSyllabus('w-dedup', proposta.syllabus);
      await d.recarregar();

      const s = await d.lerSyllabus('w-dedup');
      // `unico` afirma "exatamente um" e devolve esse um — a deduplicação É a
      // afirmação, não um passo intermediário para chegar nela.
      const portugues = unico(
        s.items.filter((i) => i.sourceLabel === 'Português'),
        'itens rotulados Português',
      );
      // A deduplicação vive na CARDINALIDADE das ligações — é a espinha do §2.3 do
      // spec, e vale igual para os dois adaptadores.
      expect(cargosDe(s, portugues.id)).toEqual(['c1', 'c2']);
    },
  },
  {
    nome: 'renomear um item preserva sua identidade e suas ligações',
    async roda(d) {
      const { slug, itemId } = await umSyllabusComUmItem(d, ['c1', 'c2']);
      const antes = cargosDe(await d.lerSyllabus(slug), itemId);

      await d.renomearItem(slug, itemId, 'Nome novo');
      await d.recarregar();

      const s = await d.lerSyllabus(slug);
      // Renomear não é remover e adicionar: o MESMO item passa a ter o nome novo.
      // `sourceLabel` é o único campo de nome que `SyllabusItem` tem, então afirmar
      // sobre ele não é escolher entre campos — é a única leitura possível.
      const item = unico(s.items.filter((i) => i.id === itemId), `item ${itemId}`);
      expect(item.sourceLabel).toBe('Nome novo');
      // E não desliga nada pelo caminho.
      expect(cargosDe(s, itemId)).toEqual(antes);
    },
  },
  {
    nome: 'ligar e desligar um cargo é observável depois de recarregar',
    async roda(d) {
      const { slug, itemId } = await umSyllabusComUmItem(d);

      await d.ligarACargo(slug, itemId, 'c2');
      await d.recarregar();
      expect(cargosDe(await d.lerSyllabus(slug), itemId)).toEqual(['c1', 'c2']);

      await d.desligarDeCargo(slug, itemId, 'c2');
      await d.recarregar();
      expect(cargosDe(await d.lerSyllabus(slug), itemId)).toEqual(['c1']);
    },
  },
  {
    nome: 'separar de um cargo deixa o outro cargo intacto',
    async roda(d) {
      const { slug, itemId } = await umSyllabusComUmItem(d, ['c1', 'c2']);
      await d.separarDeCargo(slug, itemId, 'c2');
      await d.recarregar();

      const s = await d.lerSyllabus(slug);
      // O item original continua ligado a c1...
      expect(cargosDe(s, itemId)).toEqual(['c1']);
      // ...e c2 continua tendo o tópico, por OUTRO item. Separar é desdobrar, não
      // excluir de um lado.
      const deC2 = unico(
        s.links.filter((l) => l.cargoId === 'c2').map((l) => l.syllabusItemId),
        'itens ligados a c2 depois da separação',
      );
      expect(deC2).not.toBe(itemId);
    },
  },
  {
    nome: 'peso e número de questões vivem na ligação, não no item',
    async roda(d) {
      const { slug, itemId } = await umSyllabusComUmItem(d, ['c1', 'c2']);
      await d.atualizarLigacao(slug, itemId, 'c1', { weight: 3, questionCount: 12 });
      await d.recarregar();

      const s = await d.lerSyllabus(slug);
      const deC1 = unico(
        s.links.filter((l) => l.syllabusItemId === itemId && l.cargoId === 'c1'),
        'ligação do item com c1',
      );
      expect(deC1.weight).toBe(3);
      expect(deC1.questionCount).toBe(12);

      // O mesmo tópico vale diferente para cargos diferentes: a ligação com c2 não
      // pode ter sido arrastada junto. Sem esta asserção, uma implementação que
      // guardasse peso NO ITEM passaria.
      const deC2 = unico(
        s.links.filter((l) => l.syllabusItemId === itemId && l.cargoId === 'c2'),
        'ligação do item com c2',
      );
      expect(deC2.weight).toBeNull();
      expect(deC2.questionCount).toBeNull();
    },
  },

  // ------------------------------------------------------------------
  // Conceitos
  // ------------------------------------------------------------------
  {
    nome: 'a biblioteca de conceitos é do USUÁRIO, não de um workspace',
    async roda(d) {
      // Dois workspaces, um item em cada. Cada item cria um conceito.
      await d.criarWorkspace(umWorkspace({ slug: 'w-lib-a' }));
      await d.criarWorkspace(umWorkspace({ slug: 'w-lib-b' }));
      await d.adicionarItem('w-lib-a', null, 'Direito Constitucional', ['c1']);
      await d.adicionarItem('w-lib-b', null, 'Raciocínio Lógico', ['c1']);
      await d.recarregar();

      // Os DOIS conceitos estão na MESMA biblioteca. Se ela fosse partida por
      // workspace, cada leitura traria só o seu — e esse é exatamente o erro que
      // um adaptador de API cometeria ao pendurar `concept` em `workspace_id`
      // (§4.2 do spec: a biblioteca é global por usuário, para que um conceito seja
      // reusado entre concursos).
      const nomes = new Set((await d.lerConceitos()).map((c) => c.canonicalName));
      expect(nomes.has('Direito Constitucional')).toBe(true);
      expect(nomes.has('Raciocínio Lógico')).toBe(true);
    },
  },
  {
    nome: 'confirmar um conceito provisório muda seu status',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-conf' }));
      await d.adicionarItem('w-conf', null, 'Concordância', ['c1']);
      await d.recarregar();

      const antes = unico(
        (await d.lerConceitos()).filter((c) => c.canonicalName === 'Concordância'),
        'conceito Concordância',
      );
      // Nasce provisório: é a decisão humana que promove, e sem esta asserção o
      // cenário passaria mesmo se tudo já nascesse confirmado.
      expect(antes.status).toBe('provisional');

      await d.confirmarConceito(antes.id);
      await d.recarregar();

      const depois = unico(
        (await d.lerConceitos()).filter((c) => c.id === antes.id),
        `conceito ${antes.id}`,
      );
      expect(depois.status).toBe('confirmed');
    },
  },
  {
    nome: 'renomear um conceito preserva o nome antigo como alias',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-ren' }));
      await d.adicionarItem('w-ren', null, 'Nome antigo', ['c1']);
      await d.recarregar();

      const antes = unico(
        (await d.lerConceitos()).filter((c) => c.canonicalName === 'Nome antigo'),
        'conceito Nome antigo',
      );
      await d.renomearConceito(antes.id, 'Nome novo');
      await d.recarregar();

      const depois = unico(
        (await d.lerConceitos()).filter((c) => c.id === antes.id),
        `conceito ${antes.id}`,
      );
      expect(depois.canonicalName).toBe('Nome novo');
      // Rastreabilidade: o edital dizia o nome antigo. Perder essa equivalência
      // quebra a reconciliação numa reimportação — o rótulo antigo voltaria como
      // conceito novo, duplicado, sem caminho de volta. É o único momento em que a
      // equivalência é conhecida.
      expect(depois.aliases).toContain('Nome antigo');
    },
  },

  // ------------------------------------------------------------------
  // Aprovações
  // ------------------------------------------------------------------
  {
    nome: 'enfileirar deixa um item pendente',
    async roda(d) {
      const id = await d.enfileirar(umaProposta(), new Date('2026-03-01T12:00:00Z'));
      await d.recarregar();

      const item = unico(
        (await d.lerAprovacoes()).filter((i) => i.id === id),
        `aprovação ${id}`,
      );
      expect(item.status).toBe('pendente');
      expect(item.decidedAt).toBeNull();
    },
  },
  {
    nome: 'aprovar decide o item e registra QUANDO, sem dizer qual instante',
    async roda(d) {
      const id = await d.enfileirar(umaProposta(), new Date('2026-03-01T12:00:00Z'));
      await d.aprovar(id);
      await d.recarregar();

      const item = unico(
        (await d.lerAprovacoes()).filter((i) => i.id === id),
        `aprovação ${id}`,
      );
      expect(item.status).toBe('aprovado');
      // Afirma que EXISTE, não qual valor: o relógio é de quem chama, e congelar um
      // instante aqui acoplaria o contrato ao fuso da máquina que roda o teste.
      expect(item.decidedAt).toBeTruthy();
    },
  },
  {
    nome: 'rejeitar preserva o motivo',
    async roda(d) {
      const id = await d.enfileirar(umaProposta(), new Date('2026-03-01T12:00:00Z'));
      await d.rejeitar(id, 'fora do edital');
      await d.recarregar();

      const item = unico(
        (await d.lerAprovacoes()).filter((i) => i.id === id),
        `aprovação ${id}`,
      );
      expect(item.status).toBe('rejeitado');
      expect(item.reason).toBe('fora do edital');
    },
  },
  {
    nome: 'aprovar uma fusão de conceito confirma o conceito alvo',
    async roda(d) {
      await d.criarWorkspace(umWorkspace({ slug: 'w-fusao' }));
      await d.adicionarItem('w-fusao', null, 'Crase', ['c1']);
      await d.recarregar();

      const alvo = unico(
        (await d.lerConceitos()).filter((c) => c.canonicalName === 'Crase'),
        'conceito Crase',
      );
      expect(alvo.status).toBe('provisional');

      const id = await d.enfileirar(
        umaProposta({
          type: 'concept_merge',
          workspaceId: 'w-fusao',
          targetConceptId: alvo.id,
          title: 'Fundir com conceito existente',
        }),
        new Date('2026-03-01T12:00:00Z'),
      );
      await d.aprovar(id);
      await d.recarregar();

      // O EFEITO é contrato; o MECANISMO não. O adaptador local faz isso alcançando
      // três módulos por evento de janela; um adaptador de API fará numa transação.
      // O cenário afirma só o que o usuário observa: decidi a fusão, o conceito
      // deixou de ser provisório.
      const depois = unico(
        (await d.lerConceitos()).filter((c) => c.id === alvo.id),
        `conceito ${alvo.id}`,
      );
      expect(depois.status).toBe('confirmed');
    },
  },
];
