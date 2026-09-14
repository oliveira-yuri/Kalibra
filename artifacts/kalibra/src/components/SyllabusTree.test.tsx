import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { Syllabus } from '@workspace/core';
import type { Cargo } from '@/domain/useWorkspaces';
import { SyllabusTree } from './SyllabusTree';

const SYLLABUS: Syllabus = {
  items: [
    { id: 'materia-1', workspaceId: 'w1', conceptId: 'concept-1', parentItemId: null, sourceLabel: 'Língua Portuguesa', sourceExcerpt: null, page: null, confidence: 0.9, uncertain: false },
    { id: 'topico-1', workspaceId: 'w1', conceptId: 'concept-2', parentItemId: 'materia-1', sourceLabel: 'Crase', sourceExcerpt: 'Art. 12 ...', page: 4, confidence: 0.4, uncertain: true },
  ],
  links: [
    { syllabusItemId: 'materia-1', cargoId: 'c1', weight: 25, questionCount: 10 },
    { syllabusItemId: 'materia-1', cargoId: 'c2', weight: 30, questionCount: 8 },
    { syllabusItemId: 'topico-1', cargoId: 'c1', weight: null, questionCount: 5 },
  ],
};

const CARGOS: Cargo[] = [
  { id: 'c1', name: 'Analista Técnico', examDate: '2027-01-01' },
  { id: 'c2', name: 'Agente de Suporte', examDate: '2027-01-01' },
];

function noop() {}

afterEach(() => {
  cleanup();
});

// Fixture da Fase 1B.5 (Task 7): i1 ligado só a c1 ("Português", item específico de um
// cargo); i2 ligado a c1 e c2 (comum aos dois cargos do workspace). c1='Analista',
// c2='Técnico' — os nomes aparecem literalmente nas asserções abaixo ("Aplicar a
// Técnico", "só Analista").
const TASK7_SYLLABUS: Syllabus = {
  items: [
    { id: 'i1', workspaceId: 'w1', conceptId: 'concept-i1', parentItemId: null, sourceLabel: 'Português', sourceExcerpt: null, page: null, confidence: 0.9, uncertain: false },
    { id: 'i2', workspaceId: 'w1', conceptId: 'concept-i2', parentItemId: null, sourceLabel: 'Matemática', sourceExcerpt: null, page: null, confidence: 0.9, uncertain: false },
  ],
  links: [
    { syllabusItemId: 'i1', cargoId: 'c1', weight: null, questionCount: null },
    { syllabusItemId: 'i2', cargoId: 'c1', weight: null, questionCount: null },
    { syllabusItemId: 'i2', cargoId: 'c2', weight: null, questionCount: null },
  ],
};

const TASK7_CARGOS: Cargo[] = [
  { id: 'c1', name: 'Analista', examDate: '2027-01-01' },
  { id: 'c2', name: 'Técnico', examDate: '2027-01-01' },
];

/** Helper de render da Task 7: monta `SyllabusTree` com a fixture i1/i2 acima, com overrides pontuais. */
function renderTree(overrides: Partial<{
  cargoId: string | null;
  onLinkToCargo(itemId: string, cargoId: string): void;
  onSplit(itemId: string, cargoId: string): void;
  onRemove(itemId: string): void;
  onRemoveFromCargo(itemId: string, cargoId: string): void;
}> = {}) {
  return render(
    <SyllabusTree
      syllabus={TASK7_SYLLABUS}
      cargos={TASK7_CARGOS}
      cargoId={overrides.cargoId ?? null}
      onRename={noop}
      onRemove={overrides.onRemove ?? noop}
      onRemoveFromCargo={overrides.onRemoveFromCargo ?? noop}
      onAdd={noop}
      onSplit={overrides.onSplit ?? noop}
      onLinkToCargo={overrides.onLinkToCargo ?? noop}
      onWeightChange={noop}
      onQuestionCountChange={noop}
    />,
  );
}

describe('SyllabusTree — Task 11 (peso e quantidade são por cargo, nunca um campo só)', () => {
  it('com um cargo específico selecionado, os campos são editáveis e refletem a ligação daquele cargo', () => {
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId="c1" onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    const weightInput = getByTestId('input-peso-materia-1') as HTMLInputElement;
    const questionsInput = getByTestId('input-questoes-materia-1') as HTMLInputElement;
    expect(weightInput.value).toBe('25');
    expect(questionsInput.value).toBe('10');
    expect(weightInput.disabled).toBe(false);
  });

  it('editar o peso com um cargo selecionado chama onWeightChange com aquele cargo, não outro', () => {
    const onWeightChange = vi.fn();
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId="c2" onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={onWeightChange} onQuestionCountChange={noop} />,
    );
    fireEvent.change(getByTestId('input-peso-materia-1'), { target: { value: '40' } });
    expect(onWeightChange).toHaveBeenCalledWith('materia-1', 'c2', 40);
  });

  it('com "todos os cargos" (cargoId null), os campos ficam desabilitados e mostram o consolidado — maior peso, não a soma', () => {
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    const weightInput = getByTestId('input-peso-materia-1') as HTMLInputElement;
    const questionsInput = getByTestId('input-questoes-materia-1') as HTMLInputElement;
    expect(weightInput.disabled).toBe(true);
    expect(questionsInput.disabled).toBe(true);
    // maior peso entre c1 (25) e c2 (30) é 30, não a soma (55).
    expect(weightInput.value).toBe('30');
    // consolidatedQuestionCount também é o maior (10), não a soma (18).
    expect(questionsInput.value).toBe('10');
  });

  it('item incerto ganha o chip coral de incerteza', () => {
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    expect(getByTestId('chip-uncertain-topico-1')).toBeTruthy();
    expect(() => getByTestId('chip-uncertain-materia-1')).toThrow();
  });

  it('renomear via o menu de três pontos chama onRename com o novo rótulo', () => {
    const onRename = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Língua Portuguesa e Literatura');
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={onRename} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-materia-1'));
    fireEvent.click(getByTestId('button-rename-materia-1'));
    expect(onRename).toHaveBeenCalledWith('materia-1', 'Língua Portuguesa e Literatura');
    promptSpy.mockRestore();
  });

  it('excluir via o menu de três pontos chama onRemove com o itemId', () => {
    const onRemove = vi.fn();
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={onRemove} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-topico-1'));
    fireEvent.click(getByTestId('button-remove-topico-1'));
    expect(onRemove).toHaveBeenCalledWith('topico-1');
  });

  it('"adicionar tópico" chama onAdd com o id da matéria pai; "adicionar matéria" chama com null', () => {
    const onAdd = vi.fn();
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={onAdd} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-add-topic-materia-1'));
    expect(onAdd).toHaveBeenCalledWith('materia-1');
    fireEvent.click(getByTestId('button-add-subject'));
    expect(onAdd).toHaveBeenCalledWith(null);
  });

  it('filtra itens pelo cargo selecionado — item sem ligação com o cargo não aparece', () => {
    const { queryByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId="c2" onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    // "Crase" só tem ligação com c1, não c2.
    expect(queryByTestId('row-syllabus-item-topico-1')).toBeNull();
    expect(queryByTestId('row-syllabus-item-materia-1')).not.toBeNull();
  });
});

describe('SyllabusTree — Task 12 (deduplicação visível e reversível)', () => {
  it('item ligado a mais de um cargo ganha o chip neutro "N cargos"; item de um cargo só, não', () => {
    const { getByTestId, queryByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    // "Língua Portuguesa" está ligada a c1 e c2 — os dois únicos cargos desta fixture,
    // então o chip agora lê "comum a todos" (Fase 1B.5), não mais a contagem "2 cargos".
    expect(getByTestId('chip-common-materia-1').textContent).toContain('comum a todos');
    // "Crase" só tem ligação com c1 — não é comum, não ganha o chip.
    expect(queryByTestId('chip-common-topico-1')).toBeNull();
  });

  it('o menu de um item comum ganha "Separar de <cargo>" para cada cargo ligado, chamando onSplit', () => {
    const onSplit = vi.fn();
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={onSplit} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-materia-1'));
    expect(getByTestId('button-split-materia-1-c1').textContent).toContain('Analista Técnico');
    expect(getByTestId('button-split-materia-1-c2').textContent).toContain('Agente de Suporte');

    fireEvent.click(getByTestId('button-split-materia-1-c2'));
    expect(onSplit).toHaveBeenCalledWith('materia-1', 'c2');
  });

  it('o menu de um item não comum não oferece "Separar de"', () => {
    const { getByTestId, queryByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onRemoveFromCargo={noop} onAdd={noop} onSplit={noop} onLinkToCargo={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-topico-1'));
    expect(queryByTestId('button-split-topico-1-c1')).toBeNull();
  });
});

describe('vínculos por cargo (Fase 1B.5)', () => {
  it('o menu de um item específico oferece aplicar aos cargos que faltam', () => {
    // item i1 ligado só a c1, workspace com c1 e c2
    renderTree({ cargoId: null });
    fireEvent.click(screen.getByLabelText('Ações para Português'));
    expect(screen.getByTestId('button-link-i1-c2').textContent).toContain('Aplicar a Técnico');
  });

  it('não oferece aplicar a um cargo ao qual o item JÁ está ligado', () => {
    renderTree({ cargoId: null });
    fireEvent.click(screen.getByLabelText('Ações para Português'));
    expect(screen.queryByTestId('button-link-i1-c1')).toBeNull();
  });

  it('clicar em aplicar chama onLinkToCargo com o item e o cargo', () => {
    const onLinkToCargo = vi.fn();
    renderTree({ cargoId: null, onLinkToCargo });
    fireEvent.click(screen.getByLabelText('Ações para Português'));
    fireEvent.click(screen.getByTestId('button-link-i1-c2'));
    expect(onLinkToCargo).toHaveBeenCalledWith('i1', 'c2');
  });

  it('um item ligado a todos os cargos é marcado como comum a todos', () => {
    renderTree({ cargoId: null });
    expect(screen.getByTestId('chip-common-i2').textContent).toContain('comum a todos');
  });

  it('um item ligado a um cargo só é marcado com o nome daquele cargo', () => {
    renderTree({ cargoId: null });
    expect(screen.getByTestId('chip-escopo-i1').textContent).toContain('só Analista');
  });
});

/**
 * Achado I-2 da revisão final: "Excluir" apagava o item de TODOS os cargos mesmo com o
 * filtro num cargo só — violando o critério "alterar um cargo não contamina os demais".
 * O menu agora oferece as duas exclusões e DIZ qual delas vai acontecer.
 */
describe('SyllabusTree — achado I-2 (excluir daqui versus excluir de tudo)', () => {
  const abrirMenu = (itemId: string) => fireEvent.click(screen.getByTestId(`button-item-menu-${itemId}`));

  it('com o filtro num cargo, o item comum é excluído SÓ daquele cargo', () => {
    const onRemove = vi.fn();
    const onRemoveFromCargo = vi.fn();
    renderTree({ cargoId: 'c1', onRemove, onRemoveFromCargo });

    abrirMenu('i2');
    fireEvent.click(screen.getByTestId('button-remove-i2'));

    expect(onRemoveFromCargo).toHaveBeenCalledWith('i2', 'c1');
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('e o rótulo nomeia o cargo, para não haver dúvida sobre o alcance', () => {
    renderTree({ cargoId: 'c1' });
    abrirMenu('i2');
    expect(screen.getByTestId('button-remove-i2').textContent).toBe('Excluir de Analista');
  });

  it('com "todos os cargos", excluir continua removendo o item inteiro', () => {
    const onRemove = vi.fn();
    const onRemoveFromCargo = vi.fn();
    renderTree({ cargoId: null, onRemove, onRemoveFromCargo });

    abrirMenu('i2');
    expect(screen.getByTestId('button-remove-i2').textContent).toBe('Excluir de todos os cargos');
    fireEvent.click(screen.getByTestId('button-remove-i2'));

    expect(onRemove).toHaveBeenCalledWith('i2');
    expect(onRemoveFromCargo).not.toHaveBeenCalled();
  });

  it('item de um cargo só: excluir é excluir, e o rótulo não promete mais do que faz', () => {
    const onRemove = vi.fn();
    const onRemoveFromCargo = vi.fn();
    renderTree({ cargoId: 'c1', onRemove, onRemoveFromCargo });

    abrirMenu('i1');
    expect(screen.getByTestId('button-remove-i1').textContent).toBe('Excluir');
    fireEvent.click(screen.getByTestId('button-remove-i1'));

    expect(onRemove).toHaveBeenCalledWith('i1');
    expect(onRemoveFromCargo).not.toHaveBeenCalled();
  });
});
