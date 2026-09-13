import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { FsrsState, RecallRating } from './types';

export type { FsrsState, RecallRating, ReviewItemKind } from './types';

// enable_fuzz: false — o fuzz do FSRS randomiza o intervalo em alguns pontos
// percentuais para espalhar a carga de revisão. Com ele ligado, os testes de
// ordenação de intervalos (pior nota agenda mais cedo que nota melhor) ficam
// intermitentes. Fica desligado aqui de propósito; a Fase 1D decide se volta
// na configuração real.
//
// enable_short_term: false — divergência descoberta ao inspecionar
// node_modules/ts-fsrs/dist/index.d.ts: por padrão o FSRS mantém um estágio
// de "Learning" de curto prazo (minutos) antes de promover o item ao ciclo
// normal de revisão ("Review"). Este wrapper serializa o estado do FSRS em
// FsrsState (o contrato público) e não carrega o campo `state` do Card da
// biblioteca entre chamadas — de propósito, para não vazar um conceito da
// biblioteca para o contrato. Sem desligar os passos de curto prazo, uma
// única revisão "boa" deixaria o card em "Learning", e reconstruir o Card a
// partir de FsrsState não teria como saber disso; a próxima chamada trataria
// o item como se estivesse sempre em "Review", divergindo do comportamento
// real da biblioteca (por exemplo, o teste de contagem de lapso falharia:
// uma "Learning" que falha não conta lapso, só uma "Review" que falha conta).
// Desligando learning/relearning steps, o FSRS vai direto de "New" para
// "Review" já na primeira nota, o que casa exatamente com a regra que
// reconstruímos abaixo em `toCard` (reps === 0 → New, caso contrário Review).
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
