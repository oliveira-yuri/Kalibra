export type TopicStatus = 'dominar' | 'em andamento' | 'não iniciado';
export type Priority = 'alta' | 'média' | 'baixa';
export type Difficulty = 'errei' | 'difícil' | 'bom' | 'fácil';
export type ErrorStatus = 'aberto' | 'em revisão' | 'resolvido';

export type Subject = { id: string; name: string; weight: number; progress: number; color: string; questions: number };
export type Topic = { id: string; subject: string; name: string; status: TopicStatus; priority: Priority; accuracy: number; lastStudied: string };
export type ReviewCard = { id: string; prompt: string; answer: string; due: string; difficulty: Difficulty; topic: string };
export type Question = { id: string; stem: string; options: string[]; correct: number; explanation: string; subject: string; topic: string; source: string };
export type ErrorRecord = { id: string; classification: string; subject: string; topic: string; date: string; status: ErrorStatus; severity: 'crítica' | 'alta' | 'média' };
export type Recommendation = { id: string; text: string; rationale: string; impact: string; approved: boolean };
export type Note = { id: string; title: string; subject: string; updatedAt: string; content: string };
export type PlanItem = { id: string; weekday: string; date: string; label: string; subject: string; duration: string; kind: 'prática' | 'revisão' | 'teoria' | 'simulado'; tone: 'focus' | 'review' | 'quiet' };
export type Theme = 'light' | 'dark';
