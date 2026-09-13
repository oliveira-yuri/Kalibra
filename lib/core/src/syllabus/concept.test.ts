import { describe, it, expect } from 'vitest';
import {
  normalizeConceptName, matchConcept, shouldLinkDirectly,
  CONCEPT_MATCH_THRESHOLD, type Concept,
} from './concept';

const conceito = (over: Partial<Concept> = {}): Concept => ({
  id: 'k1',
  canonicalName: 'Porcentagem e juros simples',
  slug: 'porcentagem-e-juros-simples',
  parentId: null,
  kind: 'topico',
  aliases: [],
  status: 'confirmed',
  ...over,
});

describe('normalização de nome', () => {
  it('remove acentos e caixa', () => {
    expect(normalizeConceptName('Educação Física')).toBe('educacao fisica');
  });

  it('colapsa espaços e apara as pontas', () => {
    expect(normalizeConceptName('  Razão   e    proporção  ')).toBe('razao e proporcao');
  });

  it('remove numeração de item de edital', () => {
    expect(normalizeConceptName('1.2.3 Crase')).toBe('crase');
    expect(normalizeConceptName('4 - Concordância verbal')).toBe('concordancia verbal');
    expect(normalizeConceptName('II – Ortografia')).toBe('ortografia');
  });

  it('remove pontuação final', () => {
    expect(normalizeConceptName('Interpretação de textos.')).toBe('interpretacao de textos');
    expect(normalizeConceptName('Crase;')).toBe('crase');
  });

  it('devolve string vazia quando não sobra nada', () => {
    expect(normalizeConceptName('1.2.')).toBe('');
    expect(normalizeConceptName('   ')).toBe('');
  });
});

describe('casamento de conceito', () => {
  it('casa exatamente pelo nome canônico', () => {
    const match = matchConcept('Porcentagem e juros simples', [conceito()]);
    expect(match?.concept.id).toBe('k1');
    expect(match?.score).toBe(1);
  });

  it('casa ignorando acento, caixa e numeração', () => {
    const match = matchConcept('3.1 PORCENTAGEM E JUROS SIMPLES', [conceito()]);
    expect(match?.concept.id).toBe('k1');
    expect(match?.score).toBe(1);
  });

  it('casa por alias', () => {
    const match = matchConcept('Emprego do acento indicativo de crase', [
      conceito({ id: 'k2', canonicalName: 'Crase', slug: 'crase', aliases: ['Emprego do acento indicativo de crase'] }),
    ]);
    expect(match?.concept.id).toBe('k2');
    expect(match?.score).toBe(1);
  });

  it('casa parcialmente quando o nome é próximo', () => {
    const match = matchConcept('Porcentagem e juros simple', [conceito()]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThan(CONCEPT_MATCH_THRESHOLD);
    expect(match!.score).toBeLessThan(1);
  });

  it('não casa conceitos diferentes', () => {
    expect(matchConcept('Legislação municipal', [conceito()])).toBeNull();
  });

  it('devolve o melhor candidato quando há vários', () => {
    const match = matchConcept('Crase', [
      conceito({ id: 'k1', canonicalName: 'Crase e regência', slug: 'crase-e-regencia' }),
      conceito({ id: 'k2', canonicalName: 'Crase', slug: 'crase' }),
    ]);
    expect(match?.concept.id).toBe('k2');
  });

  it('devolve null para nome vazio', () => {
    expect(matchConcept('', [conceito()])).toBeNull();
    expect(matchConcept('1.2.', [conceito()])).toBeNull();
  });

  it('devolve null quando não há conceitos', () => {
    expect(matchConcept('Crase', [])).toBeNull();
  });
});

describe('decisão de ligar direto', () => {
  it('liga quando passa do limiar e o conceito é confirmado', () => {
    expect(shouldLinkDirectly({ concept: conceito(), score: 0.95 })).toBe(true);
  });

  it('não liga quando o score fica abaixo do limiar', () => {
    expect(shouldLinkDirectly({ concept: conceito(), score: 0.5 })).toBe(false);
  });

  it('não liga a conceito provisório, mesmo com casamento perfeito', () => {
    expect(shouldLinkDirectly({ concept: conceito({ status: 'provisional' }), score: 1 })).toBe(false);
  });

  it('não liga quando não houve casamento', () => {
    expect(shouldLinkDirectly(null)).toBe(false);
  });
});
