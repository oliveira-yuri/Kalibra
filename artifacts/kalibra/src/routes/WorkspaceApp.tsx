import { useEffect, useState } from 'react';
import { Route, Router as WouterRouter, Switch, useRoute } from 'wouter';
import { Shell } from '@/components/Shell';
import { Dashboard } from '@/pages/Dashboard';
import { Edital } from '@/pages/Edital';
import { EditalRevisar } from '@/pages/EditalRevisar';
import { Estudo } from '@/pages/Estudo';
import { Notas } from '@/pages/Notas';
import { Revisao } from '@/pages/Revisao';
import { Questoes } from '@/pages/Questoes';
import { Erros } from '@/pages/Erros';
import { Recomendacoes } from '@/pages/Recomendacoes';
import { Diagnostico } from '@/pages/Diagnostico';
import { NotFound } from '@/pages/NotFound';
import { initialCards, initialErrors, initialRecommendations, initialPlan, initialNotes, today } from '@/data';
import type { Difficulty, Note, Question, Theme } from '@/types';

function loadNotes() {
  if (typeof window === 'undefined') return initialNotes;
  try {
    const saved = window.localStorage.getItem('kalibra-notes');
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as Note[];
    }
  } catch {
    return initialNotes;
  }
  return initialNotes;
}

export function WorkspaceApp({ theme, onToggleTheme, slug }: { theme: Theme; onToggleTheme: () => void; slug: string }) {
  const [cards, setCards] = useState(initialCards);
  const [errors, setErrors] = useState(initialErrors);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [plan, setPlan] = useState(initialPlan);
  const [notes, setNotes] = useState(loadNotes);
  const gradeCard = (id: string, difficulty: Difficulty) => setCards((current) => current.map((card) => card.id === id ? { ...card, difficulty, due: difficulty === 'errei' ? 'Hoje' : difficulty === 'difícil' ? 'Amanhã' : difficulty === 'bom' ? '20 dez' : '24 dez' } : card));
  const registerError = (question: Question) => setErrors((current) => current.some((error) => error.topic === question.topic && error.date === today) ? current : [{ id: `e${current.length + 1}`, classification: 'falha de procedimento', subject: question.subject, topic: question.topic, date: today, status: 'aberto', severity: 'alta' }, ...current]);
  useEffect(() => {
    window.localStorage.setItem('kalibra-notes', JSON.stringify(notes));
  }, [notes]);
  const createNote = () => {
    const id = `n${Date.now()}`;
    setNotes((current) => [{ id, title: 'Nova nota', subject: 'Rascunho', updatedAt: 'agora', content: '# Nova nota\n\n' }, ...current]);
    return id;
  };
  const saveNote = (id: string, title: string, content: string) => setNotes((current) => current.map((note) => note.id === id ? { ...note, title, content, updatedAt: 'agora' } : note));
  const approveRecommendation = (id: string) => {
    setRecommendations((current) => current.map((recommendation) => recommendation.id === id ? { ...recommendation, approved: true } : recommendation));
    if (id === 'rec1') {
      setPlan((current) => current.some((item) => item.id === 'p8') ? current : [...current, { id: 'p8', weekday: 'quinta-feira', date: '18 dez', label: 'Bloco extra · porcentagem e juros', subject: 'Matemática', duration: '40 min', kind: 'prática', tone: 'focus' }]);
    }
    if (id === 'rec2') {
      setPlan((current) => current.map((item) => item.id === 'p2' ? { ...item, weekday: 'quarta-feira', date: '17 dez', label: 'Revisão antecipada · Lei de Acesso à Informação' } : item));
    }
  };
  return (
    <Shell theme={theme} onToggleTheme={onToggleTheme} workspaceSlug={slug}>
      <Switch>
        <Route path="/" component={() => <Dashboard cards={cards} onGrade={gradeCard} />} />
        <Route path="/edital" component={() => <Edital workspaceSlug={slug} />} />
        <Route path="/edital/revisar/:version" component={() => <EditalRevisar workspaceSlug={slug} />} />
        <Route path="/estudo" component={Estudo} />
        <Route path="/notas" component={() => <Notas notes={notes} onCreateNote={createNote} onSaveNote={saveNote} />} />
        <Route path="/revisao" component={() => <Revisao cards={cards} onGrade={gradeCard} />} />
        <Route path="/questoes" component={() => <Questoes onRegisterError={registerError} />} />
        <Route path="/erros" component={() => <Erros errors={errors} />} />
        <Route path="/recomendacoes" component={() => <Recomendacoes recommendations={recommendations} plan={plan} onApprove={approveRecommendation} />} />
        <Route path="/diagnostico" component={() => <Diagnostico workspaceSlug={slug} />} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

export function WorkspaceRouter({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [match, params] = useRoute('/workspace/:slug/*?');
  if (!match) return null;
  const slug = params?.slug || 'setec-campinas';
  return (
    <WouterRouter base={`/workspace/${slug}`}>
      <WorkspaceApp theme={theme} onToggleTheme={onToggleTheme} slug={slug} />
    </WouterRouter>
  );
}
