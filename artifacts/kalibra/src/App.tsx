import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, BookOpen, Brain, CalendarDays,
  Check, CheckCircle2, ChevronDown, CircleAlert, CircleDot, Clock3, FileText,
  Filter, Flag, Gauge, GraduationCap, Layers3, Lightbulb, ListChecks, Menu,
  MoreHorizontal, NotebookPen, Play, RotateCcw, Search, Settings2, ShieldAlert,
  Timer, TrendingDown, X, Zap, Moon, Sun, UploadCloud, Plus, AlertCircle
} from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ptBR } from '@clerk/localizations';
import { Home } from './pages/Home';
import { Portal } from './pages/Portal';
import { NovoWorkspace } from './pages/NovoWorkspace';
import { stageWorkspaceImport, useWorkspaces } from './store/workspaces';
import { Redirect, useRoute } from 'wouter';

import type {
  TopicStatus, Priority, Difficulty, ErrorStatus,
  Subject, Topic, ReviewCard, Question, ErrorRecord,
  Recommendation, Note, PlanItem, Theme,
} from './types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const queryClient = new QueryClient();

import { getDaysRemaining, formatShortDate, getCurrentDateFormatted, getCurrentTimeFormatted } from './lib/date-utils';
import { subjects, topics, initialCards, questions, initialErrors, initialRecommendations, initialPlan, initialNotes, today } from './data';
import { QuickPracticeRegistro } from './components/QuickPracticeRegistro';
import { useToast } from '@/hooks/use-toast';
import { Shell } from '@/components/Shell';
import { Dashboard } from '@/pages/Dashboard';
import { Edital } from '@/pages/Edital';
import { Estudo } from '@/pages/Estudo';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { Revisao } from '@/pages/Revisao';
import { Questoes } from '@/pages/Questoes';
import { Erros } from '@/pages/Erros';
import { Recomendacoes } from '@/pages/Recomendacoes';
import { Notas } from '@/pages/Notas';

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

import { Diagnostico } from './pages/Diagnostico';
import { EditalRevisar } from './pages/EditalRevisar';

function NotFound() {
  return <div className="flex min-h-[70vh] flex-col items-center justify-center text-center"><span className="k-mono text-[52px] text-[#d5f35b]">404</span><h2 className="mt-4 text-xl font-semibold">Página fora do ciclo</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Este caminho não existe no workspace atual.</p><Link href="/" className="k-button k-button-primary mt-6" data-testid="link-back-dashboard">Voltar à visão geral</Link></div>;
}


function WorkspaceApp({ theme, onToggleTheme, slug }: { theme: Theme; onToggleTheme: () => void; slug: string }) {
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

function WorkspaceRouter({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [match, params] = useRoute('/workspace/:slug/*?');
  if (!match) return null;
  const slug = params?.slug || 'setec-campinas';
  return (
    <WouterRouter base={`/workspace/${slug}`}>
      <WorkspaceApp theme={theme} onToggleTheme={onToggleTheme} slug={slug} />
    </WouterRouter>
  );
}

function HomeRedirect({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/portal" />
      </Show>
      <Show when="signed-out">
        <Home theme={theme} onToggleTheme={onToggleTheme} />
      </Show>
    </>
  );
}

function PortalRedirect({ theme, onToggleTheme }: { theme: Theme, onToggleTheme: () => void }) {
  return (
    <>
      <Show when="signed-in">
        <Portal theme={theme} onToggleTheme={onToggleTheme} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function WorkspaceRedirect({ theme, onToggleTheme }: { theme: Theme, onToggleTheme: () => void }) {
  return (
    <>
      <Show when="signed-in">
        <WorkspaceRouter theme={theme} onToggleTheme={onToggleTheme} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkProviderWithRoutes({ theme, onToggleTheme }: { theme: Theme, onToggleTheme: () => void }) {
  const [, setLocation] = useLocation();
  
  if (!clerkPubKey) {
    return <div className="p-8 text-center text-[#ff907d]">Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables.</div>;
  }

  const clerkAppearance = {
    theme: theme === 'dark' ? shadcn : undefined,
    cssLayerName: "clerk",
    options: {
      logoPlacement: "inside" as const,
      logoLinkUrl: basePath || "/",
      logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    },
    variables: {
      colorPrimary: "#6b8d00",
      colorBackground: theme === 'dark' ? "#131821" : "#ffffff",
      colorForeground: theme === 'dark' ? "#f0f0e8" : "#16232b",
      colorMutedForeground: theme === 'dark' ? "#8e98a8" : "#6f7b85",
      colorDanger: theme === 'dark' ? "#ff907d" : "#c94f45",
      colorInput: theme === 'dark' ? "#11161d" : "#ffffff",
      colorInputForeground: theme === 'dark' ? "#f0f0e8" : "#16232b",
      colorNeutral: theme === 'dark' ? "#34404d" : "#c4d0ce",
      fontFamily: "var(--app-font-sans)",
      borderRadius: "3px",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: theme === 'dark' 
        ? "bg-[#131821] rounded-[3px] border border-[#29313d] w-[440px] max-w-full overflow-hidden" 
        : "bg-white rounded-[3px] border border-[#d5dede] w-[440px] max-w-full overflow-hidden",
      card: "!shadow-none !border-0 !bg-transparent !rounded-none",
      footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
      headerTitle: "text-[27px] font-semibold tracking-[-.05em]",
      headerSubtitle: "text-[12px] leading-5 text-[#8e98a8]",
      socialButtonsBlockButtonText: "font-semibold text-[13px]",
      formFieldLabel: "text-[12px] font-medium mb-1",
      footerActionLink: "text-[#6b8d00] hover:text-[#5f7900]",
      footerActionText: "text-[12px]",
      dividerText: "text-[11px] uppercase tracking-wider",
      identityPreviewEditButton: "text-[#6b8d00]",
      formFieldSuccessText: "text-[#80d8a5]",
      alertText: "text-[#ff907d]",
      logoBox: "mb-6 justify-center",
      logoImage: "w-8 h-8",
      socialButtonsBlockButton: `!border ${theme === 'dark' ? '!border-[#34404d] hover:!bg-[#212a36]' : '!border-[#c4d0ce] hover:!bg-[#e9efed]'}`,
      formButtonPrimary: theme === 'dark' ? "!bg-[#d5f35b] hover:!bg-[#e2fb78] !text-[#10131a] !border-none" : "!bg-[#6b8d00] hover:!bg-[#587700] !text-white !border-none",
      formFieldInput: `!border ${theme === 'dark' ? '!border-[#34404d] !bg-[#11161d] focus:!border-[#d5f35b]' : '!border-[#c4d0ce] !bg-white focus:!border-[#6b8d00]'}`,
      footerAction: "mt-4",
      dividerLine: `${theme === 'dark' ? '!bg-[#29313d]' : '!bg-[#d5dede]'}`,
      alert: "border border-[#ff907d]",
      otpCodeFieldInput: `!border ${theme === 'dark' ? '!border-[#34404d] !bg-[#11161d]' : '!border-[#c4d0ce] !bg-white'}`,
      formFieldRow: "mb-4",
      main: "gap-4",
    },
  };

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={ptBR}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={() => <HomeRedirect theme={theme} onToggleTheme={onToggleTheme} />} />
        <Route path="/sign-in/*?">
          <div className={`flex min-h-[100dvh] items-center justify-center px-4 ${theme === 'dark' ? 'bg-[#10131a] text-[#f0f0e8]' : 'bg-[#f6f8f7] text-[#16232b]'}`}>
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          </div>
        </Route>
        <Route path="/sign-up/*?">
          <div className={`flex min-h-[100dvh] items-center justify-center px-4 ${theme === 'dark' ? 'bg-[#10131a] text-[#f0f0e8]' : 'bg-[#f6f8f7] text-[#16232b]'}`}>
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          </div>
        </Route>
        <Route path="/portal/novo-workspace">
          <Show when="signed-in">
            <NovoWorkspace theme={theme} onToggleTheme={onToggleTheme} />
          </Show>
          <Show when="signed-out">
            <Redirect to="/" />
          </Show>
        </Route>
        <Route path="/portal">
          <PortalRedirect theme={theme} onToggleTheme={onToggleTheme} />
        </Route>
        <Route path="/workspace/:slug/*?">
          <WorkspaceRedirect theme={theme} onToggleTheme={onToggleTheme} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('kalibra-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('kalibra-theme', theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <RoutedErrorBoundary>
            <ClerkProviderWithRoutes theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />
          </RoutedErrorBoundary>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
