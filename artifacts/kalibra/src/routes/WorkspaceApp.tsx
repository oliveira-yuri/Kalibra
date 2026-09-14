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
import { useStudyState } from '@/domain/useStudyState';
import { useNotes } from '@/domain/useNotes';
import type { Theme } from '@/types';

export function WorkspaceApp({ theme, onToggleTheme, slug }: { theme: Theme; onToggleTheme: () => void; slug: string }) {
  const { cards, errors, recommendations, plan, gradeCard, registerError, approveRecommendation } = useStudyState();
  const { notes, createNote, saveNote } = useNotes();
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
