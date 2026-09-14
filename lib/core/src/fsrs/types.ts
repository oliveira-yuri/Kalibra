/** O que o FSRS do Kalibra agenda. Flashcards NÃO entram: vão para o Anki. */
export type ReviewItemKind = 'active_recall' | 'question' | 'topic';

/** Os quatro botões que a tela de revisão já usa hoje. */
export type RecallRating = 'nada' | 'parcial' | 'bom' | 'completo';

export type FsrsState = {
  difficulty: number;
  stability: number;
  reps: number;
  lapses: number;
  /** ISO 8601 */
  dueAt: string;
  /** ISO 8601, ou null se nunca revisado */
  lastReviewAt: string | null;
};
