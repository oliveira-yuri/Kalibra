import { describe, it, expect } from 'vitest';
import {
  normalizeConceptName, matchConcept, shouldLinkDirectly, bestConceptCandidate,
  withAlias, renameConcept,
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

// Achados da revisão de fix round 1 (Task 3): a distância de edição normalizada
// sozinha funde leis, artigos e edições diferentes que só divergem num dígito
// ou num algarismo romano — o pior modo de falha possível num app de
// concursos, onde o número da norma É o significado. Cada par abaixo veio
// medido contra o código antes do fix (score entre parênteses); depois do
// fix, os três primeiros não podem mais casar e o quarto — uma abreviação de
// ano real — continua casando.
describe('guarda de numeração — não funde leis, artigos ou edições diferentes', () => {
  it('NÃO casa "Lei 8.080/1990" com "Lei 8.078/1990" (era 0.857)', () => {
    expect(matchConcept('Lei 8.080/1990', [conceito({ canonicalName: 'Lei 8.078/1990' })])).toBeNull();
  });

  it('NÃO casa "Art. 37 da CF" com "Art. 38 da CF" (era 0.923)', () => {
    expect(matchConcept('Art. 37 da CF', [conceito({ canonicalName: 'Art. 38 da CF' })])).toBeNull();
  });

  it('NÃO casa "Banco de dados" com "Banco de dados II" (era 0.824)', () => {
    expect(matchConcept('Banco de dados', [conceito({ canonicalName: 'Banco de dados II' })])).toBeNull();
  });

  it('continua casando uma variante real de ano abreviado (0.889)', () => {
    const match = matchConcept('Decreto 1.171/1994', [conceito({ canonicalName: 'Decreto 1.171/94' })]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeCloseTo(0.8888888888888888, 10);
  });

  it('não deixa a guarda vazar para comparações sem número nenhum', () => {
    // "civil" e "penal" não são numeração; a rejeição deste par tem que vir
    // só do score (0.692, abaixo do limiar), nunca da guarda de dígitos.
    expect(matchConcept('Direito Civil', [conceito({ canonicalName: 'Direito Penal' })])).toBeNull();
    expect(matchConcept('Direito Civil', [conceito({ canonicalName: 'Direito Civil' })])?.score).toBe(1);
  });
});

// Fix round 2, achado A (crítico, residual): o truncamento aceitava qualquer
// par de dígitos onde um é sufixo do outro, em QUALQUER tamanho — "137"
// batia com "37", "5" batia com "15". Isso é o typo mais comum de artigo de
// edital ("Art. 5" virar "Art. 15"), não uma variante real. A tolerância
// agora vale só para o formato específico de ano abreviado (4 dígitos vs os
// 2 últimos deles).
describe('guarda de numeração — truncamento só para ano abreviado, não qualquer sufixo', () => {
  it('NÃO casa "Art. 137 da CF" com "Art. 37 da CF" (137 não é truncamento válido de 37)', () => {
    expect(matchConcept('Art. 137 da CF', [conceito({ canonicalName: 'Art. 37 da CF' })])).toBeNull();
  });

  it('NÃO casa "Art. 5 da CF" com "Art. 15 da CF" (typo comum de edital, não variante)', () => {
    expect(matchConcept('Art. 5 da CF', [conceito({ canonicalName: 'Art. 15 da CF' })])).toBeNull();
  });

  it('NÃO casa "Lei 8.112/1990" com "Lei 8.12/1990" (112 não é truncamento válido de 12)', () => {
    expect(matchConcept('Lei 8.112/1990', [conceito({ canonicalName: 'Lei 8.12/1990' })])).toBeNull();
  });

  it('continua casando o ano abreviado de 4 para 2 dígitos (0.889)', () => {
    const match = matchConcept('Decreto 1.171/1994', [conceito({ canonicalName: 'Decreto 1.171/94' })]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeCloseTo(0.8888888888888888, 10);
  });
});

// Fix round 2, achado D (importante): o algarismo romano tinha dois
// problemas. (1) O limite de 4 letras perdia numerais reais de edital
// (XVIII, XXIII, XXVII, XXVIII) — um numeral não reconhecido não vira token
// nenhum, então a guarda fica cega e deixa passar pela distância de edição
// pura. (2) A checagem era só "letras do alfabeto i/v/x/l/c/d/m", não uma
// sequência romana válida — palavras comuns do português ("civil", "mil")
// passavam como numeração.
describe('guarda de numeração — algarismo romano validado, não só o alfabeto', () => {
  it('NÃO casa "Capítulo XVIII" com "Capítulo XXIII" (numeral > 4 letras, antes ficava cego)', () => {
    expect(matchConcept('Capítulo XVIII', [conceito({ canonicalName: 'Capítulo XXIII' })])).toBeNull();
  });

  it('NÃO casa "Parte XXVII" com "Parte XXVIII" (mesma faixa XXXII–XXXIX)', () => {
    expect(matchConcept('Parte XXVII', [conceito({ canonicalName: 'Parte XXVIII' })])).toBeNull();
  });

  it('continua casando algarismos romanos idênticos curtos e longos', () => {
    expect(
      matchConcept('Banco de dados II', [conceito({ canonicalName: 'Banco de dados II' })])?.score,
    ).toBe(1);
    expect(
      matchConcept('Capítulo XVIII', [conceito({ canonicalName: 'Capítulo XVIII' })])?.score,
    ).toBe(1);
  });
});

describe('normalizeConceptName — palavra comum não é numeração, mesmo parecendo romana', () => {
  it('não corta "civil" como se fosse algarismo romano', () => {
    // Bug idêntico ao da guarda de similaridade, só que aqui na normalização
    // — mais grave, porque corrompe a identidade do item guardado, não só
    // uma comparação.
    expect(normalizeConceptName('Civil e processual civil')).toBe('civil e processual civil');
  });

  it('não corta "mil" como se fosse algarismo romano', () => {
    expect(normalizeConceptName('Mil e uma')).toBe('mil e uma');
  });

  it('não corta "dividi" nem "vivi" como numeração', () => {
    expect(normalizeConceptName('Dividi o texto')).toBe('dividi o texto');
    expect(normalizeConceptName('Vivi isso')).toBe('vivi isso');
  });

  it('continua cortando algarismo romano de verdade e marcador de lista', () => {
    expect(normalizeConceptName('II – Ortografia')).toBe('ortografia');
    expect(normalizeConceptName('XVIII - Direitos sociais')).toBe('direitos sociais');
    expect(normalizeConceptName('a) Something')).toBe('something');
  });
});

// O limiar de casamento não pode ser garantido só por testes cujo resultado
// também passaria com qualquer outra constante razoável (0.5, 0.6, 0.95...).
// Este par tem edit-distance fixa e conhecida — mover CONCEPT_MATCH_THRESHOLD
// quebra um destes dois testes.
describe('limiar de casamento — score fixo, não implícito', () => {
  it('não casa um pouco abaixo do limiar (score fixo 0.8076923076923077)', () => {
    const match = matchConcept('abcdefghijklmnopqrstuvwxyz', [
      conceito({ canonicalName: 'abcdfghjklmopqstuwxyz' }),
    ]);
    expect(match).toBeNull();
  });

  it('casa um pouco acima do limiar (score fixo 0.8214285714285714)', () => {
    const match = matchConcept('abcdefghijklmnopqrstuvwxyzab', [
      conceito({ canonicalName: 'abcdfghiklmnpqrtuvwyzab' }),
    ]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeCloseTo(0.8214285714285714, 10);
  });
});

describe('bestConceptCandidate — melhor candidato sem corte de limiar', () => {
  it('devolve o candidato mesmo abaixo do limiar, ao contrário de matchConcept', () => {
    const financeira = conceito({ canonicalName: 'Matemática financeira' });
    expect(matchConcept('Matemática financeira básica', [financeira])).toBeNull();

    const match = bestConceptCandidate('Matemática financeira básica', [financeira]);
    expect(match).not.toBeNull();
    expect(match!.score).toBe(0.75);
    expect(match!.score).toBeLessThan(CONCEPT_MATCH_THRESHOLD);
  });

  it('ainda respeita a guarda de numeração', () => {
    expect(bestConceptCandidate('Lei 8.080/1990', [conceito({ canonicalName: 'Lei 8.078/1990' })])).toBeNull();
  });

  it('devolve null para nome vazio ou lista vazia', () => {
    expect(bestConceptCandidate('', [conceito()])).toBeNull();
    expect(bestConceptCandidate('Crase', [])).toBeNull();
  });
});

// Achado C2/I1 da revisão final: `diffSyllabus` lê aliases via `matchConcept`, mas
// nada em produção escrevia um — estas duas funções são o produtor que faltava.
describe('withAlias', () => {
  it('acrescenta um alias novo', () => {
    const concept = conceito({ aliases: [] });
    expect(withAlias(concept, 'Crase').aliases).toEqual(['Crase']);
  });

  it('é idempotente — não duplica um alias já presente', () => {
    const concept = conceito({ aliases: ['Crase'] });
    expect(withAlias(concept, 'Crase').aliases).toEqual(['Crase']);
  });

  it('não acrescenta um alias igual ao nome canônico — não informa nada', () => {
    const concept = conceito({ canonicalName: 'Crase', aliases: [] });
    expect(withAlias(concept, 'Crase').aliases).toEqual([]);
  });

  it('ignora string vazia ou só espaço', () => {
    const concept = conceito({ aliases: [] });
    expect(withAlias(concept, '   ').aliases).toEqual([]);
  });

  it('apara espaços do alias antes de comparar/gravar', () => {
    const concept = conceito({ aliases: [] });
    expect(withAlias(concept, '  Crase  ').aliases).toEqual(['Crase']);
  });

  it('devolve o mesmo objeto (sem cópia) quando não há mudança — barato de chamar em loop', () => {
    const concept = conceito({ canonicalName: 'Crase', aliases: [] });
    expect(withAlias(concept, 'Crase')).toBe(concept);
  });
});

describe('renameConcept — o mecanismo do PD-08 ("renomeado ≠ removido + adicionado")', () => {
  it('troca o nome canônico e preserva o anterior como alias', () => {
    const concept = conceito({ canonicalName: 'Crase', aliases: [] });
    const renamed = renameConcept(concept, 'Emprego do acento indicativo de crase');
    expect(renamed.canonicalName).toBe('Emprego do acento indicativo de crase');
    expect(renamed.aliases).toEqual(['Crase']);
  });

  it('depois de renomear, o rótulo ANTIGO ainda casa via matchConcept (alias) — é exatamente o que permite a v2 do edital linkar ao mesmo concept', () => {
    const concept = conceito({ canonicalName: 'Crase', aliases: [] });
    const renamed = renameConcept(concept, 'Emprego do acento indicativo de crase');
    expect(matchConcept('Crase', [renamed])?.concept.id).toBe(concept.id);
    expect(matchConcept('Emprego do acento indicativo de crase', [renamed])?.concept.id).toBe(concept.id);
  });

  it('não duplica o alias ao renomear duas vezes para o mesmo nome final', () => {
    const concept = conceito({ canonicalName: 'Crase', aliases: [] });
    const once = renameConcept(concept, 'Emprego do acento indicativo de crase');
    const twice = renameConcept(once, 'Emprego do acento indicativo de crase');
    expect(twice).toBe(once);
  });

  it('sem efeito para nome vazio ou idêntico ao atual', () => {
    const concept = conceito({ canonicalName: 'Crase', aliases: [] });
    expect(renameConcept(concept, '   ')).toBe(concept);
    expect(renameConcept(concept, 'Crase')).toBe(concept);
  });

  it('uma segunda renomeação empilha o alias anterior, sem perder o primeiro', () => {
    const concept = conceito({ canonicalName: 'Crase', aliases: [] });
    const first = renameConcept(concept, 'Emprego do acento indicativo de crase');
    const second = renameConcept(first, 'Crase (uso do acento grave)');
    expect(second.canonicalName).toBe('Crase (uso do acento grave)');
    expect(second.aliases).toEqual(['Crase', 'Emprego do acento indicativo de crase']);
  });
});
