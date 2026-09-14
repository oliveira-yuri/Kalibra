import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
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

describe('SyllabusTree — Task 11 (peso e quantidade são por cargo, nunca um campo só)', () => {
  it('com um cargo específico selecionado, os campos são editáveis e refletem a ligação daquele cargo', () => {
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId="c1" onRename={noop} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
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
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId="c2" onRename={noop} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={onWeightChange} onQuestionCountChange={noop} />,
    );
    fireEvent.change(getByTestId('input-peso-materia-1'), { target: { value: '40' } });
    expect(onWeightChange).toHaveBeenCalledWith('materia-1', 'c2', 40);
  });

  it('com "todos os cargos" (cargoId null), os campos ficam desabilitados e mostram o consolidado — maior peso, não a soma', () => {
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
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
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    expect(getByTestId('chip-uncertain-topico-1')).toBeTruthy();
    expect(() => getByTestId('chip-uncertain-materia-1')).toThrow();
  });

  it('renomear via o menu de três pontos chama onRename com o novo rótulo', () => {
    const onRename = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Língua Portuguesa e Literatura');
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={onRename} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-materia-1'));
    fireEvent.click(getByTestId('button-rename-materia-1'));
    expect(onRename).toHaveBeenCalledWith('materia-1', 'Língua Portuguesa e Literatura');
    promptSpy.mockRestore();
  });

  it('excluir via o menu de três pontos chama onRemove com o itemId', () => {
    const onRemove = vi.fn();
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={onRemove} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-topico-1'));
    fireEvent.click(getByTestId('button-remove-topico-1'));
    expect(onRemove).toHaveBeenCalledWith('topico-1');
  });

  it('"adicionar tópico" chama onAdd com o id da matéria pai; "adicionar matéria" chama com null', () => {
    const onAdd = vi.fn();
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onAdd={onAdd} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-add-topic-materia-1'));
    expect(onAdd).toHaveBeenCalledWith('materia-1');
    fireEvent.click(getByTestId('button-add-subject'));
    expect(onAdd).toHaveBeenCalledWith(null);
  });

  it('filtra itens pelo cargo selecionado — item sem ligação com o cargo não aparece', () => {
    const { queryByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId="c2" onRename={noop} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    // "Crase" só tem ligação com c1, não c2.
    expect(queryByTestId('row-syllabus-item-topico-1')).toBeNull();
    expect(queryByTestId('row-syllabus-item-materia-1')).not.toBeNull();
  });
});

describe('SyllabusTree — Task 12 (deduplicação visível e reversível)', () => {
  it('item ligado a mais de um cargo ganha o chip neutro "N cargos"; item de um cargo só, não', () => {
    const { getByTestId, queryByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    // "Língua Portuguesa" está ligada a c1 e c2 — é o item comum desta fixture.
    expect(getByTestId('chip-common-materia-1').textContent).toContain('2 cargos');
    // "Crase" só tem ligação com c1 — não é comum, não ganha o chip.
    expect(queryByTestId('chip-common-topico-1')).toBeNull();
  });

  it('o menu de um item comum ganha "Separar de <cargo>" para cada cargo ligado, chamando onSplit', () => {
    const onSplit = vi.fn();
    const { getByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onAdd={noop} onSplit={onSplit} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-materia-1'));
    expect(getByTestId('button-split-materia-1-c1').textContent).toContain('Analista Técnico');
    expect(getByTestId('button-split-materia-1-c2').textContent).toContain('Agente de Suporte');

    fireEvent.click(getByTestId('button-split-materia-1-c2'));
    expect(onSplit).toHaveBeenCalledWith('materia-1', 'c2');
  });

  it('o menu de um item não comum não oferece "Separar de"', () => {
    const { getByTestId, queryByTestId } = render(
      <SyllabusTree syllabus={SYLLABUS} cargos={CARGOS} cargoId={null} onRename={noop} onRemove={noop} onAdd={noop} onSplit={noop} onWeightChange={noop} onQuestionCountChange={noop} />,
    );
    fireEvent.click(getByTestId('button-item-menu-topico-1'));
    expect(queryByTestId('button-split-topico-1-c1')).toBeNull();
  });
});
