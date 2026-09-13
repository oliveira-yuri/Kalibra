import { useState } from 'react';
import { initialCards, initialErrors, initialRecommendations, initialPlan, today } from '@/data';
import type { Difficulty, ErrorRecord, PlanItem, Question, Recommendation, ReviewCard } from '@/types';

export function useStudyState() {
  const [cards, setCards] = useState<ReviewCard[]>(initialCards);
  const [errors, setErrors] = useState<ErrorRecord[]>(initialErrors);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations);
  const [plan, setPlan] = useState<PlanItem[]>(initialPlan);

  const gradeCard = (id: string, difficulty: Difficulty) =>
    setCards((current) => current.map((card) => card.id === id
      ? { ...card, difficulty, due: difficulty === 'errei' ? 'Hoje' : difficulty === 'difícil' ? 'Amanhã' : difficulty === 'bom' ? '20 dez' : '24 dez' }
      : card));

  const registerError = (question: Question) =>
    setErrors((current) => current.some((error) => error.topic === question.topic && error.date === today)
      ? current
      : [{ id: `e${current.length + 1}`, classification: 'falha de procedimento', subject: question.subject, topic: question.topic, date: today, status: 'aberto', severity: 'alta' }, ...current]);

  const approveRecommendation = (id: string) => {
    setRecommendations((current) => current.map((r) => r.id === id ? { ...r, approved: true } : r));
    if (id === 'rec1') {
      setPlan((current) => current.some((item) => item.id === 'p8')
        ? current
        : [...current, { id: 'p8', weekday: 'quinta-feira', date: '18 dez', label: 'Bloco extra · porcentagem e juros', subject: 'Matemática', duration: '40 min', kind: 'prática', tone: 'focus' }]);
    }
    if (id === 'rec2') {
      setPlan((current) => current.map((item) => item.id === 'p2'
        ? { ...item, weekday: 'quarta-feira', date: '17 dez', label: 'Revisão antecipada · Lei de Acesso à Informação' }
        : item));
    }
  };

  return { cards, errors, recommendations, plan, gradeCard, registerError, approveRecommendation };
}
