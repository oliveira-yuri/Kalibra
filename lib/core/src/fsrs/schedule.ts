import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { FsrsState, RecallRating } from './types';

export type { FsrsState, RecallRating, ReviewItemKind } from './types';

// enable_fuzz: false — o fuzz do FSRS randomiza o intervalo em alguns pontos
// percentuais para espalhar a carga de revisão. Com ele ligado, os testes de
// ordenação de intervalos (pior nota agenda mais cedo que nota melhor) ficam
// intermitentes. Fica desligado aqui de propósito; a Fase 1D decide se volta
// na configuração real.
//
// enable_short_term: false — decisão de produto, não workaround técnico. Os
// itens que passam por aqui (active_recall, question, topic) não têm a
// propriedade de repetição barata do flashcard — flashcard é Anki, fora de
// escopo. Reescrever uma resposta 10 minutos depois testa memorização de
// transcrição, não recuperação; refazer uma questão logo após a explicação
// testa reconhecimento e contamina as estatísticas de acerto. A tela
// /revisoes é uma previsão de carga por dia contra os minutos disponíveis do
// usuário — itens vencendo em 1 ou 10 minutos não cabem num balde diário. E,
// de forma mais concreta: `previewIntervals` existe para mostrar quantos DIAS
// cada botão custa; com learning steps ligados, `nada`/`parcial`/`bom`
// caem em "Learning" (due em 1m/6m/10m) e arredondariam para "0 dias" — só
// `completo` (Easy) pula direto para "Review" com dias de verdade. Por isso
// o menor intervalo aqui é sempre >= 1 dia — ver o teste "nunca agenda no
// mesmo dia" em schedule.test.ts.
//
// Nota de suporte: desligar isso também mantém a reconstrução do Card em
// `toCard` simples. FsrsState não guarda o `state` (New/Learning/Review/
// Relearning) do Card da biblioteca de propósito, para não vazar esse
// conceito no contrato público. Sem learning steps, o FSRS só transita entre
// New e Review, o que a regra abaixo (reps === 0 → New, senão Review)
// reconstrói fielmente — se algum dia "resolver" isso adicionando `state` a
// FsrsState, o motivo de produto acima continua de pé; a trava não pode ser
// reaberta assumindo que o problema era só de serialização.
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false }));

const RATING_MAP: Record<RecallRating, Grade> = {
  nada: Rating.Again,
  parcial: Rating.Hard,
  bom: Rating.Good,
  completo: Rating.Easy,
};

const RATINGS: readonly RecallRating[] = ['nada', 'parcial', 'bom', 'completo'];

function toCard(state: FsrsState): Card {
  const card = createEmptyCard(new Date(state.dueAt));
  return {
    ...card,
    // Com enable_short_term: false, o FSRS só conhece dois estados úteis aqui:
    // nunca revisado (New) ou já revisado ao menos uma vez (Review). Isso é
    // suficiente para reconstruir o Card real a partir do FsrsState público.
    state: state.reps === 0 ? State.New : State.Review,
    difficulty: state.difficulty,
    stability: state.stability,
    reps: state.reps,
    lapses: state.lapses,
    due: new Date(state.dueAt),
    last_review: state.lastReviewAt ? new Date(state.lastReviewAt) : undefined,
  };
}

function fromCard(card: Card): FsrsState {
  return {
    difficulty: card.difficulty,
    stability: card.stability,
    reps: card.reps,
    lapses: card.lapses,
    dueAt: card.due.toISOString(),
    lastReviewAt: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function newFsrsState(now: Date): FsrsState {
  return fromCard(createEmptyCard(now));
}

export function scheduleReview(state: FsrsState, rating: RecallRating, now: Date): FsrsState {
  const result = scheduler.next(toCard(state), now, RATING_MAP[rating]);
  return fromCard(result.card);
}

export function isDue(state: FsrsState, now: Date): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime();
}

const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

export function previewIntervals(state: FsrsState, now: Date): Record<RecallRating, number> {
  const preview = {} as Record<RecallRating, number>;
  for (const rating of RATINGS) {
    const next = scheduleReview(state, rating, now);
    const dias = Math.round((new Date(next.dueAt).getTime() - now.getTime()) / MS_IN_A_DAY);
    preview[rating] = Math.max(0, dias);
  }
  return preview;
}
