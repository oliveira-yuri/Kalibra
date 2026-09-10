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
  Timer, TrendingDown, X, Zap, Moon, Sun,
} from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ptBR } from '@clerk/localizations';
import { Home } from './pages/Home';
import { Portal } from './pages/Portal';
import { Redirect, useRoute } from 'wouter';


type TopicStatus = 'dominar' | 'em andamento' | 'não iniciado';
type Priority = 'alta' | 'média' | 'baixa';
type Difficulty = 'errei' | 'difícil' | 'bom' | 'fácil';
type ErrorStatus = 'aberto' | 'em revisão' | 'resolvido';

type Subject = { id: string; name: string; weight: number; progress: number; color: string; questions: number };
type Topic = { id: string; subject: string; name: string; status: TopicStatus; priority: Priority; accuracy: number; lastStudied: string };
type ReviewCard = { id: string; prompt: string; answer: string; due: string; difficulty: Difficulty; topic: string };
type Question = { id: string; stem: string; options: string[]; correct: number; explanation: string; subject: string; topic: string; source: string };
type ErrorRecord = { id: string; classification: string; subject: string; topic: string; date: string; status: ErrorStatus; severity: 'crítica' | 'alta' | 'média' };
type Recommendation = { id: string; text: string; rationale: string; impact: string; approved: boolean };
type Note = { id: string; title: string; subject: string; updatedAt: string; content: string };
type PlanItem = { id: string; weekday: string; date: string; label: string; subject: string; duration: string; kind: 'prática' | 'revisão' | 'teoria' | 'simulado'; tone: 'focus' | 'review' | 'quiet' };
type Theme = 'light' | 'dark';

const subjects: Subject[] = [
  { id: 'mat', name: 'Matemática', weight: 35, progress: 48, color: '#d5f35b', questions: 34 },
  { id: 'por', name: 'Português', weight: 30, progress: 61, color: '#64d4d5', questions: 29 },
  { id: 'esp', name: 'Conhecimentos Específicos', weight: 35, progress: 32, color: '#ff907d', questions: 21 },
];

const topics: Topic[] = [
  { id: 't1', subject: 'Matemática', name: 'Razão, proporção e regra de três', status: 'em andamento', priority: 'alta', accuracy: 54, lastStudied: 'há 2 dias' },
  { id: 't2', subject: 'Matemática', name: 'Porcentagem e juros simples', status: 'em andamento', priority: 'alta', accuracy: 47, lastStudied: 'há 5 dias' },
  { id: 't3', subject: 'Matemática', name: 'Conjuntos numéricos', status: 'dominar', priority: 'baixa', accuracy: 81, lastStudied: 'há 8 dias' },
  { id: 't4', subject: 'Português', name: 'Interpretação de textos', status: 'em andamento', priority: 'alta', accuracy: 63, lastStudied: 'ontem' },
  { id: 't5', subject: 'Português', name: 'Concordância e regência', status: 'não iniciado', priority: 'média', accuracy: 0, lastStudied: 'nunca' },
  { id: 't6', subject: 'Conhecimentos Específicos', name: 'Lei de Acesso à Informação', status: 'em andamento', priority: 'alta', accuracy: 39, lastStudied: 'há 3 dias' },
  { id: 't7', subject: 'Conhecimentos Específicos', name: 'Administração pública direta', status: 'não iniciado', priority: 'média', accuracy: 0, lastStudied: 'nunca' },
  { id: 't8', subject: 'Conhecimentos Específicos', name: 'Ética no serviço público', status: 'dominar', priority: 'baixa', accuracy: 76, lastStudied: 'há 11 dias' },
];

const initialCards: ReviewCard[] = [
  { id: 'r1', prompt: 'Em uma proporção 3:5, se o primeiro termo vale 24, qual é o segundo?', answer: '40. A razão de ampliação é 24 ÷ 3 = 8; então 5 × 8 = 40.', due: 'Hoje', difficulty: 'difícil', topic: 'Razão, proporção e regra de três' },
  { id: 'r2', prompt: 'Qual princípio garante que a administração pública só pode agir conforme a lei?', answer: 'Princípio da legalidade.', due: 'Hoje', difficulty: 'bom', topic: 'Administração pública direta' },
  { id: 'r3', prompt: 'Na interpretação textual, o que diferencia inferência de informação explícita?', answer: 'A inferência é construída a partir de pistas do texto; a informação explícita está declarada diretamente.', due: 'Amanhã', difficulty: 'fácil', topic: 'Interpretação de textos' },
];

const questions: Question[] = [
  { id: 'q1', stem: 'Uma repartição reduziu em 20% o tempo médio de atendimento, que era de 45 minutos. Qual é o novo tempo médio?', options: ['36 minutos', '37 minutos', '38 minutos', '40 minutos', '42 minutos'], correct: 0, explanation: 'Uma redução de 20% equivale a manter 80% do valor: 45 × 0,8 = 36 minutos.', subject: 'Matemática', topic: 'Porcentagem e juros simples', source: 'SETEC · simulado 03' },
  { id: 'q2', stem: 'Assinale a alternativa em que a relação de sentido está corretamente identificada.', options: ['“Embora” indica causa.', '“Portanto” indica conclusão.', '“Porque” indica condição.', '“Caso” indica concessão.', '“Ainda que” indica finalidade.'], correct: 1, explanation: '“Portanto” é um conectivo conclusivo e introduz uma consequência ou fechamento lógico.', subject: 'Português', topic: 'Interpretação de textos', source: 'SETEC · simulado 02' },
  { id: 'q3', stem: 'De acordo com a Lei de Acesso à Informação, a publicidade é regra e o sigilo é:', options: ['proibido em qualquer hipótese.', 'a regra para dados administrativos.', 'exceção, nos casos previstos em lei.', 'facultativo para o agente público.', 'obrigatório em processos internos.'], correct: 2, explanation: 'A LAI estabelece a publicidade como preceito geral e o sigilo como exceção, nas hipóteses legais.', subject: 'Conhecimentos Específicos', topic: 'Lei de Acesso à Informação', source: 'SETEC · bloco específico 01' },
];

const initialErrors: ErrorRecord[] = [
  { id: 'e1', classification: 'falha de conceito', subject: 'Matemática', topic: 'Porcentagem e juros simples', date: '12 dez 2025', status: 'aberto', severity: 'alta' },
  { id: 'e2', classification: 'distração de leitura', subject: 'Português', topic: 'Interpretação de textos', date: '10 dez 2025', status: 'em revisão', severity: 'média' },
  { id: 'e3', classification: 'confusão normativa', subject: 'Conhecimentos Específicos', topic: 'Lei de Acesso à Informação', date: '08 dez 2025', status: 'aberto', severity: 'crítica' },
  { id: 'e4', classification: 'procedimento', subject: 'Matemática', topic: 'Razão, proporção e regra de três', date: '04 dez 2025', status: 'resolvido', severity: 'média' },
];

const initialRecommendations: Recommendation[] = [
  { id: 'rec1', text: 'Adicionar 2 blocos de Matemática antes do próximo simulado.', rationale: 'Porcentagem e juros simples está 12 p.p. abaixo do corte de segurança e concentra 3 erros abertos.', impact: '+40 min/semana · ciclo atual', approved: false },
  { id: 'rec2', text: 'Antecipar a revisão de Lei de Acesso à Informação para hoje.', rationale: 'A última sessão teve baixa retenção e há um cartão vencido associado ao tópico.', impact: 'Move 1 sessão · sem alterar carga', approved: false },
  { id: 'rec3', text: 'Trocar o próximo bloco de teoria por 12 questões de interpretação.', rationale: 'Português já possui cobertura suficiente; prática contextualizada deve reduzir distrações de leitura.', impact: 'Substitui 25 min · hoje', approved: true },
];

const initialPlan: PlanItem[] = [
  { id: 'p1', weekday: 'quarta-feira', date: '17 dez', label: 'Resolver 8 questões de porcentagem', subject: 'Matemática', duration: '25 min', kind: 'prática', tone: 'focus' },
  { id: 'p2', weekday: 'quinta-feira', date: '18 dez', label: 'Revisar Lei de Acesso à Informação', subject: 'Conhecimentos Específicos', duration: '20 min', kind: 'revisão', tone: 'review' },
  { id: 'p3', weekday: 'sexta-feira', date: '19 dez', label: 'Praticar interpretação de textos', subject: 'Português', duration: '30 min', kind: 'prática', tone: 'focus' },
  { id: 'p4', weekday: 'sábado', date: '20 dez', label: 'Revisar razão e proporção', subject: 'Matemática', duration: '20 min', kind: 'revisão', tone: 'review' },
  { id: 'p5', weekday: 'domingo', date: '21 dez', label: 'Estudar concordância e regência', subject: 'Português', duration: '25 min', kind: 'teoria', tone: 'quiet' },
  { id: 'p6', weekday: 'segunda-feira', date: '22 dez', label: 'Simulado misto · bloco 04', subject: 'Todas as matérias', duration: '45 min', kind: 'simulado', tone: 'focus' },
  { id: 'p7', weekday: 'terça-feira', date: '23 dez', label: 'Revisar pontos fracos do ciclo', subject: 'Diagnóstico', duration: '30 min', kind: 'revisão', tone: 'review' },
];

const initialNotes: Note[] = [
  {
    id: 'n1',
    title: 'Porcentagem e juros simples',
    subject: 'Matemática',
    updatedAt: 'há 12 min',
    content: '# Porcentagem e juros simples\n\n## Regra principal\n\nPorcentagem é uma razão com denominador 100. Para evitar erro de operação, transforme a taxa em fator antes de calcular.\n\n`valor final = valor inicial × (1 ± taxa/100)`\n\n## Lembretes\n\n- aumento de 18% → fator **1,18**\n- redução de 20% → fator **0,80**\n- em variações sucessivas, aplique um fator depois do outro\n\n> Em uma redução, o resultado precisa ser menor que o valor inicial.',
  },
  {
    id: 'n2',
    title: 'Lei de Acesso à Informação',
    subject: 'Conhecimentos Específicos',
    updatedAt: 'ontem',
    content: '# Lei de Acesso à Informação\n\nA publicidade é o preceito geral e o sigilo é a exceção, nos casos previstos em lei.\n\n## Para revisar\n\n- transparência ativa e passiva\n- hipóteses legais de sigilo\n- prazo e recurso do pedido de acesso',
  },
  {
    id: 'n3',
    title: 'Interpretação: inferência x explícito',
    subject: 'Português',
    updatedAt: 'há 3 dias',
    content: '# Interpretação de textos\n\n**Informação explícita** está declarada diretamente no texto.\n\n**Inferência** é construída a partir de pistas e relações presentes no texto. Não é opinião livre: precisa ser sustentada por evidências do enunciado.',
  },
];

const queryClient = new QueryClient();
const today = '17 dez 2025';

function IconLabel({ icon: Icon, children }: { icon: typeof Activity; children: ReactNode }) {
  return <span className="flex items-center gap-2"><Icon size={15} strokeWidth={1.8} />{children}</span>;
}

const navItems = [
  { href: '/', label: 'Visão geral', icon: Gauge },
  { href: '/edital', label: 'Edital', icon: ListChecks },
  { href: '/estudo', label: 'Estudo', icon: BookOpen },
  { href: '/notas', label: 'Notas', icon: NotebookPen },
  { href: '/revisao', label: 'Revisão', icon: RotateCcw },
  { href: '/questoes', label: 'Questões', icon: FileText },
  { href: '/erros', label: 'Erros', icon: ShieldAlert },
  { href: '/recomendacoes', label: 'Recomendações', icon: Lightbulb },
];

function Shell({ children, theme, onToggleTheme, workspaceSlug = '' }: { children: ReactNode; theme: Theme; onToggleTheme: () => void; workspaceSlug?: string }) {
  const [location] = useLocation();
  const { user } = useUser();
  const current = navItems.find((item) => {
    return item.href === '/' ? location === '/' : location.startsWith(item.href);
  }) ?? navItems[0];
  
  return (
    <div className="kalibra-shell flex flex-col md:flex-row">
      <aside className="k-sidebar flex w-full flex-col md:fixed md:inset-y-0 md:w-[224px]">
        <div className="flex h-[68px] items-center justify-between border-b border-[#242a34] px-5">
          <Link href={`~${basePath}/portal`} className="flex items-center gap-3" data-testid="link-brand">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#d5f35b] text-[#10131a]"><Activity size={16} strokeWidth={2.6} /></span>
            <span className="text-[15px] font-bold tracking-[-0.04em]">kalibra<span className="text-[#d5f35b]">.</span></span>
          </Link>
          <button className="k-button k-button-quiet k-icon-button md:hidden" data-testid="button-mobile-menu" aria-label="Abrir menu"><Menu size={17} /></button>
        </div>
        <div className="hidden px-4 py-5 md:block">
          <p className="k-eyebrow mb-2">workspace ativo</p>
          <p className="text-[12px] font-medium text-[#e9e9e0]">{workspaceSlug === 'setec-campinas' ? 'Concurso SETEC Campinas' : 'Workspace'}</p>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-[#8e98a8]"><CalendarDays size={12} /><span className="k-mono">17 JAN 2026</span><span className="ml-auto k-focus k-mono">D−42</span></div>
          <Link href={`~${basePath}/portal`} className="k-button k-button-quiet mt-4 w-full justify-start !px-0 text-[11px]" data-testid="link-back-to-portal">
            <ArrowLeft size={14} /> Voltar aos concursos
          </Link>
        </div>
        <nav className="k-mobile-nav flex-1 gap-1 px-2 pb-2 md:block md:px-3 md:py-3">
          <p className="k-eyebrow hidden px-3 pb-2 pt-1 md:block">navegação</p>
          {navItems.map((item) => {
             const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
             return <Link key={item.href} href={item.href} className={`k-nav-item ${active ? 'k-nav-item-active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><item.icon size={16} /><span>{item.label}</span>{item.href === '/revisao' && <span className="ml-auto rounded-sm bg-[#ff907d] px-1.5 py-0.5 text-[9px] font-bold text-[#171416]">3</span>}</Link>;
          })}
        </nav>
        <div className="hidden border-t border-[#242a34] p-4 md:block">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#27352a] text-[10px] font-bold text-[#d5f35b]">
              {user?.firstName?.[0]?.toUpperCase() || 'E'}
            </span>
            <div>
              <p className="text-[11px] font-semibold">{user?.firstName || 'Estudante'}</p>
              <p className="text-[10px] text-[#8e98a8]">sessão de estudos</p>
            </div>
            <MoreHorizontal className="ml-auto text-[#8e98a8]" size={15} />
          </div>
          <button className="k-button k-button-quiet w-full justify-start px-1 text-[11px]" data-testid="button-settings"><Settings2 size={14} /> Preferências</button>
        </div>
      </aside>
      <main className="k-main min-h-[calc(100dvh-115px)] flex-1 md:ml-[224px] md:min-h-dvh">
        <header className="flex min-h-[68px] items-center justify-between border-b border-[#242a34] px-5 md:px-9">
          <div><p className="k-eyebrow mb-1">{current.label}</p><h1 className="text-[15px] font-semibold tracking-[-0.02em]">{current.href === '/' ? 'Seu próximo passo, sem ruído.' : current.label}</h1></div>
          <div className="flex items-center gap-2"><button className="k-button k-button-quiet k-icon-button" data-testid="button-search" aria-label="Buscar"><Search size={16} /></button><button className="k-button k-button-quiet k-icon-button" data-testid="button-notifications" aria-label="Notificações"><CircleDot size={16} /></button><button className="k-button k-button-quiet k-icon-button" onClick={onToggleTheme} data-testid="button-theme-toggle" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><span className="mx-1 h-5 w-px bg-[#29313d]" /><span className="hidden text-right sm:block"><span className="block text-[11px] font-medium">quarta, 17 dez</span><span className="k-mono block text-[9px] text-[#8e98a8]">08:42 BRT</span></span></div>
        </header>
        <div className="mx-auto max-w-[1440px] p-5 md:p-9">{children}</div>
      </main>
    </div>
  );
}

function Metric({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <div className="k-card p-4"><p className="k-eyebrow mb-4">{label}</p><p className={`k-mono text-[25px] font-medium tracking-[-0.06em] ${accent ? 'k-focus' : 'text-[#f0f0e8]'}`}>{value}</p><p className="mt-2 text-[11px] text-[#8e98a8]">{note}</p></div>;
}

function Dashboard({ cards, onGrade }: { cards: ReviewCard[]; onGrade: (id: string, difficulty: Difficulty) => void }) {
  const dueCards = cards.filter((card) => card.due === 'Hoje');
  return <div className="space-y-5">
    <section className="k-grid relative overflow-hidden border border-[#29313d] bg-[#131821] p-5 md:p-7">
      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_.8fr]"><div><div className="mb-4 flex items-center gap-2"><span className="k-chip k-chip-active">CICLO 04</span><span className="k-chip">diagnóstico atualizado há 18 min</span></div><h2 className="max-w-[590px] text-[29px] font-semibold leading-[1.02] tracking-[-0.055em] md:text-[39px]">O que move sua nota agora é <span className="k-focus">Matemática.</span></h2><p className="mt-4 max-w-[520px] text-[13px] leading-6 text-[#aeb8c5]">Porcentagem e Lei de Acesso à Informação concentram os maiores riscos. Resolva uma sessão curta antes de abrir conteúdo novo.</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/questoes" className="k-button k-button-primary" data-testid="link-start-next-action"><Play size={14} fill="currentColor" /> Começar sessão recomendada</Link><Link href="/estudo" className="k-button" data-testid="link-open-study"><BookOpen size={14} /> Abrir estudo</Link></div></div><div className="flex flex-col justify-between border-l border-[#29313d] pl-6 lg:min-h-[178px]"><p className="k-eyebrow">até a prova</p><div><p className="k-mono text-[60px] leading-none tracking-[-0.08em] text-[#d5f35b]">42</p><p className="mt-2 text-[12px] text-[#aeb8c5]">dias restantes · 17 janeiro 2026</p></div><div className="flex gap-6 text-[11px]"><span><strong className="k-mono text-[#f0f0e8]">14</strong><span className="ml-1 text-[#8e98a8]">sessões planejadas</span></span><span><strong className="k-mono text-[#f0f0e8]">3</strong><span className="ml-1 text-[#8e98a8]">revisões vencidas</span></span></div></div></div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="progresso geral" value="47,2%" note="+6,8 p.p. em 14 dias" accent /><Metric label="questões resolvidas" value="84" note="64 corretas · 20 incorretas" /><Metric label="retenção média" value="68%" note="últimas 32 revisões" /><Metric label="tempo de foco" value="6h 20" note="esta semana · meta 8h" /></div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="k-card p-5"><div className="mb-5 flex items-center justify-between"><div><p className="k-eyebrow">cobertura por matéria</p><h3 className="mt-1 text-[16px] font-semibold">Onde seu tempo está rendendo</h3></div><Link href="/edital" className="k-button k-button-quiet text-[11px]" data-testid="link-view-syllabus">Ver edital <ArrowRight size={13} /></Link></div><div className="space-y-5">{subjects.map((subject) => <div key={subject.id} data-testid={`row-subject-${subject.id}`}><div className="mb-2 flex items-center justify-between text-[12px]"><span className="flex items-center gap-2 font-medium"><span className="h-2 w-2 rounded-full" style={{ background: subject.color }} />{subject.name}</span><span className="k-mono text-[#aeb8c5]">{subject.progress}% <span className="text-[#657181]">/ peso {subject.weight}%</span></span></div><div className="k-progress"><span style={{ width: `${subject.progress}%`, background: subject.color }} /></div><div className="mt-2 flex justify-between text-[10px] text-[#6f7b8b]"><span>{subject.questions} questões no diagnóstico</span><span>{subject.progress < 50 ? 'abaixo do corte' : 'ritmo consistente'}</span></div></div>)}</div></section>
      <section className="k-card p-5"><div className="mb-5 flex items-center justify-between"><div><p className="k-eyebrow">próximas revisões</p><h3 className="mt-1 text-[16px] font-semibold">Fila de hoje</h3></div><Link href="/revisao" className="k-button k-button-quiet text-[11px]" data-testid="link-view-reviews">Abrir fila <ArrowRight size={13} /></Link></div><div className="space-y-2">{dueCards.map((card) => <div key={card.id} className="flex items-center gap-3 border-t border-[#242c37] py-3"><span className={`h-2 w-2 rounded-full ${card.difficulty === 'difícil' ? 'bg-[#ff907d]' : 'bg-[#d5f35b]'}`} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{card.topic}</p><p className="mt-1 text-[10px] text-[#8e98a8]">{card.difficulty} · vencimento {card.due.toLowerCase()}</p></div><button className="k-button k-button-quiet k-icon-button" onClick={() => onGrade(card.id, 'bom')} data-testid={`button-quick-review-${card.id}`} aria-label={`Marcar ${card.topic} como bom`}><Check size={15} /></button></div>)}</div><div className="mt-4 border border-dashed border-[#394452] p-3 text-[11px] text-[#8e98a8]"><span className="k-focus">Fila leve.</span> Complete as 3 cartas para liberar o próximo bloco.</div></section>
    </div>
    <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><section className="k-card p-5"><div className="mb-5 flex items-center gap-2"><TrendingDown size={16} className="k-coral" /><div><p className="k-eyebrow">pontos de atenção</p><h3 className="mt-1 text-[16px] font-semibold">Onde você está perdendo pontos</h3></div></div><div className="space-y-3">{topics.filter((topic) => topic.priority === 'alta').map((topic) => <Link href="/estudo" key={topic.id} className="flex items-center gap-3 border-t border-[#242c37] py-3" data-testid={`link-weak-topic-${topic.id}`}><span className="k-mono w-9 text-[11px] text-[#ff907d]">{topic.accuracy}%</span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{topic.name}</p><p className="mt-1 text-[10px] text-[#8e98a8]">{topic.subject} · {topic.lastStudied}</p></div><ArrowRight size={14} className="text-[#68788b]" /></Link>)}</div></section><section className="k-card-soft p-5"><div className="flex items-start gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#283322] text-[#d5f35b]"><Zap size={17} /></div><div><p className="k-eyebrow">próximo movimento</p><h3 className="mt-1 text-[17px] font-semibold">Resolver 8 questões de porcentagem</h3><p className="mt-2 max-w-[510px] text-[12px] leading-5 text-[#aeb8c5]">Sessão calibrada para 25 minutos. A meta é identificar se o erro é de fórmula, leitura ou operação — não apenas acumular acertos.</p><div className="mt-5 flex flex-wrap items-center gap-3"><Link href="/questoes" className="k-button k-button-primary" data-testid="link-recommended-session"><Play size={14} fill="currentColor" /> Iniciar agora</Link><span className="k-mono text-[10px] text-[#7e8998]">8 itens · 25 min · nível misto</span></div></div></div></section></div>
  </div>;
}

function Edital() {
  const [subjectFilter, setSubjectFilter] = useState('Todas');
  const [priorityFilter, setPriorityFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');
  const filtered = topics.filter((topic) => (subjectFilter === 'Todas' || topic.subject === subjectFilter) && (priorityFilter === 'todas' || topic.priority === priorityFilter) && (statusFilter === 'todos' || topic.status === statusFilter));
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="k-eyebrow mb-2">estrutura da prova · 84 tópicos mapeados</p><h2 className="text-[26px] font-semibold tracking-[-0.045em]">Edital em estado de estudo</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Use o status como decisão de próxima sessão, não como checklist decorativo.</p></div><button className="k-button" data-testid="button-export-syllabus"><FileText size={14} /> Exportar recorte</button></div><div className="k-card flex flex-col gap-3 p-3 md:flex-row"><div className="flex items-center gap-2 text-[11px] text-[#8e98a8]"><Filter size={14} /> filtros ativos</div><select className="k-input md:w-[210px]" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} data-testid="select-subject-filter"><option>Todas</option>{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select><select className="k-input md:w-[145px]" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} data-testid="select-priority-filter"><option value="todas">Prioridade</option><option value="alta">Alta</option><option value="média">Média</option><option value="baixa">Baixa</option></select><select className="k-input md:w-[165px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} data-testid="select-status-filter"><option value="todos">Todos os status</option><option value="dominar">Dominar</option><option value="em andamento">Em andamento</option><option value="não iniciado">Não iniciado</option></select><span className="ml-auto hidden items-center gap-2 px-2 text-[10px] text-[#8e98a8] md:flex"><span className="h-2 w-2 rounded-full bg-[#d5f35b]" />{filtered.length} tópicos</span></div><div className="k-card overflow-hidden"><div className="hidden grid-cols-[1.2fr_1.5fr_.7fr_.7fr_.8fr_40px] gap-4 bg-[#131820] px-5 py-3 text-[10px] uppercase tracking-[.1em] text-[#697587] md:grid"><span>matéria</span><span>tópico</span><span>prioridade</span><span>acerto</span><span>status</span><span /></div>{filtered.map((topic) => <div key={topic.id} className="k-table-row grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1.5fr_.7fr_.7fr_.8fr_40px] md:items-center md:gap-4" data-testid={`row-topic-${topic.id}`}><div><span className="text-[11px] text-[#aeb8c5]">{topic.subject}</span><span className="mt-1 block text-[10px] text-[#647080]">{topic.lastStudied}</span></div><div><Link href="/estudo" className="text-[12px] font-medium hover:text-[#d5f35b]" data-testid={`link-topic-${topic.id}`}>{topic.name}</Link><div className="mt-2 k-progress md:max-w-[180px]"><span style={{ width: `${Math.max(topic.accuracy, 3)}%`, background: topic.accuracy < 55 ? '#ff907d' : '#d5f35b' }} /></div></div><span className={`k-chip w-fit ${topic.priority === 'alta' ? 'border-[#75433e] text-[#ff907d]' : ''}`}>{topic.priority}</span><span className={`k-mono text-[12px] ${topic.accuracy < 55 ? 'k-coral' : 'text-[#b9c4d0]'}`}>{topic.accuracy ? `${topic.accuracy}%` : '—'}</span><span className={`w-fit text-[10px] ${topic.status === 'dominar' ? 'text-[#8ed9ae]' : topic.status === 'em andamento' ? 'text-[#d5f35b]' : 'text-[#8e98a8]'}`}>{topic.status}</span><button className="k-button k-button-quiet k-icon-button" data-testid={`button-topic-menu-${topic.id}`} aria-label={`Ações para ${topic.name}`}><MoreHorizontal size={15} /></button></div>)}</div></div>;
}

function Study() {
  const [tab, setTab] = useState('explicação');
  const [complete, setComplete] = useState(false);
  const tabs = ['explicação', 'flashcards', 'questões', 'resumo', 'erros'];
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 border-b border-[#29313d] pb-5 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-2"><span className="k-chip k-chip-active">MATEMÁTICA</span><span className="k-chip">PRIORIDADE ALTA</span></div><h2 className="text-[28px] font-semibold tracking-[-0.05em]">Porcentagem e juros simples</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Sessão guiada · última prática há 5 dias · acerto atual 47%</p></div><div className="flex gap-2"><button className={`k-button ${complete ? 'border-[#8ed9ae] text-[#8ed9ae]' : 'k-button-primary'}`} onClick={() => setComplete(!complete)} data-testid="button-complete-study">{complete ? <CheckCircle2 size={14} /> : <Check size={14} />} {complete ? 'Sessão registrada' : 'Marcar como estudado'}</button><Link href="/questoes" className="k-button" data-testid="link-study-questions"><Play size={14} /> Praticar</Link></div></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]"><section className="k-card overflow-hidden"><div className="flex gap-1 overflow-x-auto border-b border-[#29313d] p-2">{tabs.map((item) => <button key={item} className={`k-button whitespace-nowrap border-0 px-3 text-[11px] capitalize ${tab === item ? 'bg-[#283322] text-[#d5f35b]' : 'k-button-quiet'}`} onClick={() => setTab(item)} data-testid={`button-study-tab-${item}`}>{item}</button>)}</div><div className="p-5 md:p-8">{tab === 'explicação' && <article className="prose prose-invert max-w-none prose-headings:tracking-[-.04em] prose-p:text-[13px] prose-p:leading-7 prose-p:text-[#b8c1cc]"><p className="k-eyebrow not-prose">base para resolver</p><h3>Porcentagem é uma razão com denominador 100</h3><p>Quando uma grandeza varia em porcentagem, o valor percentual funciona como um fator de transformação. O caminho mais seguro é sempre escrever o fator antes de calcular.</p><div className="not-prose my-5 border-l-2 border-[#d5f35b] bg-[#1b241e] p-4"><p className="k-mono text-[13px] text-[#d5f35b]">valor final = valor inicial × (1 ± taxa/100)</p><p className="mt-2 text-[11px] text-[#aeb8c5]">Use + para aumento e − para redução.</p></div><h3>Exemplo de prova</h3><p>Uma taxa de inscrição de R$ 80 sofreu reajuste de 12,5%. O acréscimo é 80 × 0,125 = R$ 10. O valor final é R$ 90.</p><div className="not-prose mt-6 grid gap-3 sm:grid-cols-2"><div className="k-card-soft p-4"><p className="k-eyebrow mb-2">atenção</p><p className="text-[12px] leading-5 text-[#d7dde4]">Não some a taxa ao número sem antes converter a porcentagem para fator.</p></div><div className="k-card-soft p-4"><p className="k-eyebrow mb-2">checagem rápida</p><p className="text-[12px] leading-5 text-[#d7dde4]">Em redução, o resultado precisa ser menor que o valor inicial.</p></div></div></article>}{tab === 'flashcards' && <Flashcards />}{tab === 'questões' && <div className="flex flex-col items-start gap-4"><p className="k-eyebrow">prática deliberada</p><h3 className="text-[19px] font-semibold">Teste o procedimento antes de avançar</h3><p className="max-w-[530px] text-[13px] leading-6 text-[#aeb8c5]">O próximo bloco tem 8 questões com mistura de cálculo direto e interpretação de enunciado.</p><Link href="/questoes" className="k-button k-button-primary" data-testid="link-open-practice-from-study">Abrir bloco de questões <ArrowRight size={14} /></Link></div>}{tab === 'resumo' && <Summary />}{tab === 'erros' && <div className="space-y-3"><p className="k-eyebrow">erros relacionados ao tópico</p><div className="k-card-soft p-4"><p className="text-[12px] font-medium">Aplicou 15% como 0,15 no lugar de 1,15</p><p className="mt-2 text-[11px] text-[#8e98a8]">falha de procedimento · 12 dez 2025 · aberto</p></div><Link href="/erros" className="k-button k-button-quiet px-0 text-[11px]" data-testid="link-all-study-errors">Ver no caderno de erros <ArrowRight size={13} /></Link></div>}</div></section><aside className="space-y-3"><div className="k-card p-4"><p className="k-eyebrow mb-4">estado do tópico</p><div className="mb-3 flex items-end justify-between"><span className="k-mono text-[29px] text-[#ff907d]">47%</span><span className="text-[10px] text-[#8e98a8]">acerto</span></div><div className="k-progress"><span className="bg-[#ff907d]" style={{ width: '47%', background: '#ff907d' }} /></div><div className="mt-4 flex justify-between text-[10px] text-[#8e98a8]"><span>corte recomendado</span><span className="k-mono text-[#d5f35b]">70%</span></div></div><div className="k-card p-4"><p className="k-eyebrow mb-3">nesta sessão</p><div className="space-y-3 text-[11px]"><div className="flex justify-between"><span className="text-[#8e98a8]">tempo estimado</span><span className="k-mono">25 min</span></div><div className="flex justify-between"><span className="text-[#8e98a8]">questões pendentes</span><span className="k-mono">8</span></div><div className="flex justify-between"><span className="text-[#8e98a8]">revisão seguinte</span><span className="k-mono">20 dez</span></div></div></div><div className="k-card-soft p-4"><div className="flex gap-2"><Brain size={15} className="k-focus shrink-0" /><p className="text-[11px] leading-5 text-[#b8c1cc]">O diagnóstico sugere alternar explicação curta com prática imediata.</p></div></div></aside></div></div>;
}

function Flashcards() {
  const [revealed, setRevealed] = useState(false);
  return <div className="mx-auto max-w-[620px] text-center"><p className="k-eyebrow">flashcard 03 / 08</p><button className="k-card mt-4 min-h-[250px] w-full p-8 text-left" onClick={() => setRevealed(!revealed)} data-testid="button-reveal-flashcard"><span className="k-eyebrow">pergunta</span><p className="mt-8 text-[21px] font-medium leading-8 tracking-[-.035em]">Qual é o fator multiplicativo de um aumento de 18%?</p>{revealed && <div className="mt-8 border-t border-[#29313d] pt-5"><p className="k-eyebrow">resposta</p><p className="mt-2 text-[14px] text-[#d5f35b]">1,18 — mantenha 100% + 18%.</p></div>}</button><p className="mt-3 text-[10px] text-[#6f7b8b]">Clique no cartão para revelar a resposta</p></div>;
}

function Summary() {
  return <div><p className="k-eyebrow mb-5">resumo operacional</p><div className="space-y-3"><div className="k-card-soft p-4"><p className="k-mono text-[12px] text-[#d5f35b]">01 / fator</p><p className="mt-2 text-[13px] text-[#d7dde4]">Aumento → 1 + taxa. Redução → 1 − taxa.</p></div><div className="k-card-soft p-4"><p className="k-mono text-[12px] text-[#d5f35b]">02 / ordem</p><p className="mt-2 text-[13px] text-[#d7dde4]">Converta a porcentagem, aplique ao valor e confira a direção da mudança.</p></div><div className="k-card-soft p-4"><p className="k-mono text-[12px] text-[#d5f35b]">03 / prova</p><p className="mt-2 text-[13px] text-[#d7dde4]">Quando houver duas variações seguidas, aplique um fator depois do outro.</p></div></div></div>;
}

function Review({ cards, onGrade }: { cards: ReviewCard[]; onGrade: (id: string, difficulty: Difficulty) => void }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState('');
  const card = cards[index % cards.length];
  const grade = (difficulty: Difficulty) => { onGrade(card.id, difficulty); setMessage(`Registrado como ${difficulty}. Próxima revisão recalculada.`); setRevealed(true); };
  return <div className="mx-auto max-w-[1050px] space-y-5"><div className="flex items-end justify-between"><div><p className="k-eyebrow mb-2">revisão espaçada · fila 01 / {cards.length}</p><h2 className="text-[27px] font-semibold tracking-[-.05em]">Recupere antes de consultar.</h2><p className="mt-2 text-[12px] text-[#8e98a8]">A resposta só aparece depois da tentativa. Classifique o esforço, não o ego.</p></div><div className="hidden items-center gap-2 text-[11px] text-[#8e98a8] sm:flex"><Clock3 size={14} /> 3 vencidas hoje</div></div>{message && <div className="flex items-center gap-2 border border-[#526d39] bg-[#1d2a1d] px-4 py-3 text-[11px] text-[#d5f35b]" data-testid="status-review-saved"><CheckCircle2 size={14} />{message}</div>}<div className="grid gap-5 lg:grid-cols-[1fr_290px]"><section className="k-card p-6 md:p-10"><div className="flex items-center justify-between"><span className="k-chip k-chip-active">{card.topic}</span><span className="k-mono text-[10px] text-[#8e98a8]">{card.due}</span></div><div className="flex min-h-[330px] flex-col justify-center"><p className="k-eyebrow">recupere</p><h3 className="mt-5 max-w-[700px] text-[27px] font-medium leading-[1.2] tracking-[-.04em]">{card.prompt}</h3>{revealed && <div className="mt-8 border-l-2 border-[#d5f35b] bg-[#1b241e] p-4"><p className="k-eyebrow">resposta de referência</p><p className="mt-2 text-[13px] leading-6 text-[#d9e0e5]">{card.answer}</p></div>}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#29313d] pt-5"><button className="k-button" onClick={() => setRevealed(!revealed)} data-testid="button-reveal-review">{revealed ? <X size={14} /> : <Brain size={14} />} {revealed ? 'Ocultar resposta' : 'Revelar resposta'}</button>{revealed && <div className="flex flex-wrap gap-1"><button className="k-button k-button-quiet text-[10px] text-[#ff907d]" onClick={() => grade('errei')} data-testid="button-grade-errei">Errei</button><button className="k-button k-button-quiet text-[10px] text-[#ffb28a]" onClick={() => grade('difícil')} data-testid="button-grade-dificil">Difícil</button><button className="k-button k-button-quiet text-[10px] text-[#9fd6b2]" onClick={() => grade('bom')} data-testid="button-grade-bom">Bom</button><button className="k-button k-button-quiet text-[10px] text-[#d5f35b]" onClick={() => grade('fácil')} data-testid="button-grade-facil">Fácil</button></div>}</div></section><aside className="k-card p-5"><p className="k-eyebrow mb-5">ritmo de retenção</p><div className="mb-6 flex items-end gap-3"><span className="k-mono text-[42px] tracking-[-.08em] text-[#d5f35b]">68%</span><span className="mb-2 text-[10px] text-[#8e98a8]">média atual</span></div><div className="space-y-4 text-[11px]"><div><div className="mb-2 flex justify-between"><span className="text-[#aeb8c5]">errei</span><span className="k-mono text-[#ff907d]">12%</span></div><div className="k-progress"><span style={{ width: '12%', background: '#ff907d' }} /></div></div><div><div className="mb-2 flex justify-between"><span className="text-[#aeb8c5]">difícil</span><span className="k-mono text-[#ffb28a]">20%</span></div><div className="k-progress"><span style={{ width: '20%', background: '#ffb28a' }} /></div></div><div><div className="mb-2 flex justify-between"><span className="text-[#aeb8c5]">bom / fácil</span><span className="k-mono text-[#d5f35b]">68%</span></div><div className="k-progress"><span style={{ width: '68%' }} /></div></div></div><button className="k-button k-button-primary mt-8 w-full" onClick={() => { setIndex((index + 1) % cards.length); setRevealed(false); setMessage(''); }} data-testid="button-next-review">Próxima carta <ArrowRight size={14} /></button></aside></div></div>;
}

function Questions({ onRegisterError }: { onRegisterError: (question: Question) => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timed, setTimed] = useState(false);
  const question = questions[index];
  const answer = (option: number) => { setSelected(option); setShowFeedback(true); };
  const next = () => { setIndex((index + 1) % questions.length); setSelected(null); setShowFeedback(false); };
  const correct = selected === question.correct;
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="k-eyebrow mb-2">prática · sessão diagnóstica</p><h2 className="text-[27px] font-semibold tracking-[-.05em]">Questões que devolvem sinal.</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Resolva, classifique o erro e deixe o próximo passo mais preciso.</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-[11px] text-[#8e98a8]"><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} data-testid="input-timed-mode" /> <Timer size={14} /> cronômetro</label><span className="k-chip">{index + 1} / {questions.length}</span></div></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]"><section className="k-card p-5 md:p-8"><div className="mb-7 flex flex-wrap items-center gap-2"><span className="k-chip k-chip-active">{question.subject}</span><span className="k-chip">{question.topic}</span><span className="ml-auto text-[10px] text-[#6f7b8b]">{question.source}</span></div><h3 className="max-w-[760px] text-[20px] font-medium leading-8 tracking-[-.025em]">{question.stem}</h3><div className="mt-7 space-y-2">{question.options.map((option, optionIndex) => { const state = showFeedback ? optionIndex === question.correct ? 'k-option-correct' : selected === optionIndex ? 'k-option-wrong' : '' : selected === optionIndex ? 'k-option-selected' : ''; return <button key={option} className={`k-option flex w-full items-start gap-3 p-3 text-left text-[12px] ${state}`} onClick={() => answer(optionIndex)} data-testid={`button-option-${optionIndex}`}><span className="k-mono flex h-5 w-5 shrink-0 items-center justify-center border border-[#455161] text-[10px] text-[#aeb8c5]">{String.fromCharCode(65 + optionIndex)}</span><span className="pt-0.5">{option}</span>{showFeedback && optionIndex === question.correct && <Check size={15} className="ml-auto text-[#8ed9ae]" />}</button> })}</div>{showFeedback && <div className={`mt-5 border p-4 ${correct ? 'border-[#526d39] bg-[#1d2a1d]' : 'border-[#75433e] bg-[#30201f]'}`} data-testid="status-question-feedback"><div className="flex items-center gap-2 text-[12px] font-semibold">{correct ? <CheckCircle2 size={15} className="text-[#8ed9ae]" /> : <CircleAlert size={15} className="k-coral" />}{correct ? 'Resposta correta' : 'Resposta incorreta'}</div><p className="mt-2 text-[12px] leading-5 text-[#b8c1cc]">{question.explanation}</p></div>}<div className="mt-7 flex flex-wrap justify-between gap-2 border-t border-[#29313d] pt-5"><button className="k-button k-button-quiet" onClick={() => { setSelected(null); setShowFeedback(false); }} data-testid="button-reset-question"><RotateCcw size={14} /> Limpar resposta</button><div className="flex gap-2">{showFeedback && !correct && <button className="k-button text-[#ff907d]" onClick={() => onRegisterError(question)} data-testid="button-register-error"><Flag size={14} /> Registrar erro</button>}<button className="k-button k-button-primary" onClick={next} disabled={!showFeedback} data-testid="button-next-question">Próxima questão <ArrowRight size={14} /></button></div></div></section><aside className="space-y-3"><div className="k-card p-5"><p className="k-eyebrow mb-4">sessão atual</p><div className="grid grid-cols-2 gap-3"><div><p className="k-mono text-[25px] text-[#d5f35b]">02</p><p className="mt-1 text-[10px] text-[#8e98a8]">acertos</p></div><div><p className="k-mono text-[25px] text-[#ff907d]">01</p><p className="mt-1 text-[10px] text-[#8e98a8]">a revisar</p></div></div><div className="mt-5 k-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div></div><div className="k-card-soft p-4"><p className="k-eyebrow mb-2">classifique depois</p><p className="text-[11px] leading-5 text-[#aeb8c5]">Registrar o erro abre uma linha no caderno e alimenta as recomendações — sem alterar o ciclo automaticamente.</p></div></aside></div></div>;
}

function Errors({ errors }: { errors: ErrorRecord[] }) {
  const [status, setStatus] = useState('todos');
  const [severity, setSeverity] = useState('todas');
  const [search, setSearch] = useState('');
  const filtered = errors.filter((error) => (status === 'todos' || error.status === status) && (severity === 'todas' || error.severity === severity) && `${error.topic} ${error.classification}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5"><div><p className="k-eyebrow mb-2">memória de erro · 4 registros</p><h2 className="text-[27px] font-semibold tracking-[-.05em]">O caderno que muda seu próximo bloco.</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Erros permanecem visíveis até que a evidência de correção seja registrada.</p></div><div className="grid gap-3 sm:grid-cols-3"><Metric label="abertos" value="02" note="exigem nova tentativa" accent /><Metric label="em revisão" value="01" note="aguardando confirmação" /><Metric label="resolvidos" value="01" note="nos últimos 14 dias" /></div><div className="k-card grid gap-3 p-3 md:grid-cols-[minmax(180px,1fr)_155px_135px_auto]"><div className="relative min-w-0"><Search size={14} className="absolute left-3 top-2.5 text-[#6f7b8b]" /><input className="k-input pl-9" placeholder="Buscar tópico ou causa" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-errors" /></div><select className="k-input" value={status} onChange={(event) => setStatus(event.target.value)} data-testid="select-error-status"><option value="todos">Todos os status</option><option value="aberto">Aberto</option><option value="em revisão">Em revisão</option><option value="resolvido">Resolvido</option></select><select className="k-input" value={severity} onChange={(event) => setSeverity(event.target.value)} data-testid="select-error-severity"><option value="todas">Severidade</option><option value="crítica">Crítica</option><option value="alta">Alta</option><option value="média">Média</option></select><span className="hidden items-center gap-2 whitespace-nowrap px-2 text-[10px] text-[#8e98a8] md:flex"><Filter size={13} /> {filtered.length} registros</span></div><div className="k-card overflow-hidden"><div className="hidden grid-cols-[1.25fr_1fr_.75fr_.8fr_.8fr] gap-4 bg-[#131820] px-5 py-3 text-[10px] uppercase tracking-[.1em] text-[#697587] md:grid"><span>causa do erro</span><span>tópico</span><span>data</span><span>severidade</span><span>status</span></div>{filtered.length === 0 ? <div className="flex flex-col items-center gap-2 p-12 text-center"><Search size={20} className="text-[#68788b]" /><p className="text-[13px] font-medium">Nenhum erro corresponde ao recorte</p><p className="text-[11px] text-[#8e98a8]">Tente remover um filtro ou buscar por outra causa.</p></div> : filtered.map((error) => <div key={error.id} className="k-table-row grid gap-2 px-5 py-4 md:grid-cols-[1.25fr_1fr_.75fr_.8fr_.8fr] md:items-center md:gap-4" data-testid={`row-error-${error.id}`}><div><p className="text-[12px] font-medium">{error.classification}</p><p className="mt-1 text-[10px] text-[#8e98a8]">{error.subject}</p></div><p className="text-[11px] text-[#c6ced8]">{error.topic}</p><p className="k-mono text-[10px] text-[#8e98a8]">{error.date}</p><span className={`w-fit k-chip ${error.severity === 'crítica' ? 'border-[#75433e] text-[#ff907d]' : error.severity === 'alta' ? 'border-[#73553e] text-[#ffb28a]' : ''}`}>{error.severity}</span><span className={`text-[10px] ${error.status === 'aberto' ? 'text-[#ff907d]' : error.status === 'em revisão' ? 'text-[#d5f35b]' : 'text-[#8ed9ae]'}`}>{error.status}</span></div>)}</div></div>;
}

function StudyCalendar({ plan }: { plan: PlanItem[] }) {
  return <section className="k-card p-5" data-testid="section-study-calendar">
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <p className="k-eyebrow mb-2">plano da semana · atualizado pelo diagnóstico</p>
        <h3 className="text-[18px] font-semibold tracking-[-.04em]">O que estudar em cada dia</h3>
        <p className="mt-2 max-w-[620px] text-[12px] leading-5 text-[#8e98a8]">Aprovações recalibram os próximos blocos sem apagar o histórico do que já foi estudado.</p>
      </div>
      <span className="k-chip">{plan.length} blocos planejados</span>
    </div>
    <div className="k-plan-grid">
      {plan.map((item) => <article key={item.id} className={`k-plan-item k-plan-${item.tone}`} data-testid={`plan-item-${item.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="k-eyebrow">{item.weekday}</p><p className="k-mono mt-1 text-[17px] font-medium">{item.date}</p></div>
          <span className="k-plan-dot" />
        </div>
        <p className="mt-5 text-[12px] font-semibold leading-5">{item.label}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-[#8e98a8]"><span>{item.subject}</span><span className="k-mono">{item.duration}</span></div>
        <span className="k-plan-kind mt-3 inline-flex">{item.kind}</span>
      </article>)}
    </div>
    <div className="k-card-soft mt-4 flex items-start gap-3 p-4"><CalendarDays size={15} className="k-focus mt-0.5 shrink-0" /><p className="text-[11px] leading-5 text-[#aeb8c5]">O calendário é uma proposta de ciclo. Nada muda automaticamente sem sua aprovação.</p></div>
  </section>;
}

function Recommendations({ recommendations, plan, onApprove }: { recommendations: Recommendation[]; plan: PlanItem[]; onApprove: (id: string) => void }) {
  const pending = recommendations.filter((recommendation) => !recommendation.approved);
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="k-eyebrow mb-2">ajustes do ciclo · aprovação manual</p><h2 className="text-[27px] font-semibold tracking-[-.05em]">Recomendações com freio.</h2><p className="mt-2 max-w-[650px] text-[12px] leading-5 text-[#8e98a8]">O diagnóstico pode sugerir mudanças, mas nada entra no seu calendário sem sua aprovação.</p></div><span className="k-chip k-chip-active">{pending.length} aguardando decisão</span></div>
    <div className="k-card border-[#39452f] bg-[#151d18] p-4"><div className="flex gap-3"><Lightbulb size={17} className="k-focus mt-0.5 shrink-0" /><div><p className="text-[12px] font-semibold text-[#d5f35b]">Como o ajuste funciona</p><p className="mt-1 text-[11px] text-[#aeb8c5] leading-5">Aprovar altera somente o próximo ciclo. Histórico e cartões anteriores permanecem intactos.</p></div></div></div>
    <div className="space-y-3">{recommendations.map((recommendation) => <article key={recommendation.id} className={`k-card p-5 ${recommendation.approved ? 'border-[#354a3c]' : ''}`} data-testid={`card-recommendation-${recommendation.id}`}><div className="flex flex-col justify-between gap-4 md:flex-row"><div className="flex gap-4"><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${recommendation.approved ? 'bg-[#243329] text-[#8ed9ae]' : 'bg-[#2b3024] text-[#d5f35b]'}`}>{recommendation.approved ? <Check size={16} /> : <Zap size={16} />}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-[14px] font-semibold">{recommendation.text}</p>{recommendation.approved && <span className="k-chip border-[#42604b] text-[#8ed9ae]">aprovada</span>}</div><p className="mt-2 max-w-[700px] text-[12px] leading-5 text-[#aeb8c5]">{recommendation.rationale}</p><p className="k-mono mt-3 text-[10px] text-[#7e8998]">impacto · {recommendation.impact}</p>{recommendation.approved && recommendation.id !== 'rec3' && <p className="mt-3 text-[10px] text-[#23824d]">Calendário atualizado com este ajuste.</p>}</div></div>{!recommendation.approved && <button className="k-button k-button-primary self-start whitespace-nowrap" onClick={() => onApprove(recommendation.id)} data-testid={`button-approve-${recommendation.id}`}><Check size={14} /> Aprovar ajuste</button>}</div></article>)}</div>
    <div className="k-card-soft flex items-start gap-3 p-4"><ShieldAlert size={15} className="k-coral mt-0.5" /><p className="text-[11px] leading-5 text-[#aeb8c5]">Aprovação é reversível no histórico do ciclo. Se o contexto mudar, você pode revisar a decisão antes da próxima sessão.</p></div>
    <StudyCalendar plan={plan} />
  </div>;
}

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

function MarkdownPreview({ content }: { content: string }) {
  return <div className="k-markdown-preview" data-testid="notes-markdown-preview">
    {content.split('\n').map((line, index) => {
      if (!line.trim()) return <div className="h-3" key={`space-${index}`} />;
      if (line.startsWith('### ')) return <h4 key={index}>{line.slice(4)}</h4>;
      if (line.startsWith('## ')) return <h3 key={index}>{line.slice(3)}</h3>;
      if (line.startsWith('# ')) return <h2 key={index}>{line.slice(2)}</h2>;
      if (line.startsWith('- ')) return <li key={index}>{line.slice(2)}</li>;
      if (line.startsWith('> ')) return <blockquote key={index}>{line.slice(2)}</blockquote>;
      if (line.startsWith('`') && line.endsWith('`')) return <pre key={index}><code>{line.slice(1, -1)}</code></pre>;
      return <p key={index}>{line}</p>;
    })}
  </div>;
}

function Notes({ notes, onCreateNote, onSaveNote }: { notes: Note[]; onCreateNote: () => string; onSaveNote: (id: string, title: string, content: string) => void }) {
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? '');
  const [draftTitle, setDraftTitle] = useState(notes[0]?.title ?? '');
  const [draftContent, setDraftContent] = useState(notes[0]?.content ?? '');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [saved, setSaved] = useState(false);
  const selectedNote = notes.find((note) => note.id === selectedId);

  useEffect(() => {
    const note = notes.find((item) => item.id === selectedId);
    if (!note) return;
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setView('edit');
    setSaved(false);
  }, [selectedId]);

  const selectNote = (id: string) => {
    setSelectedId(id);
    setSaved(false);
  };
  const createNote = () => {
    const id = onCreateNote();
    setSelectedId(id);
  };
  const saveNote = () => {
    if (!selectedNote) return;
    onSaveNote(selectedNote.id, draftTitle.trim() || 'Sem título', draftContent);
    setSaved(true);
  };

  return <div className="space-y-5" data-testid="page-notes">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><p className="k-eyebrow mb-2">caderno pessoal · markdown</p><h2 className="text-[27px] font-semibold tracking-[-.05em]">Notas para pensar antes de praticar.</h2><p className="mt-2 max-w-[650px] text-[12px] leading-5 text-[#8e98a8]">Escreva explicações, fórmulas e conexões. O conteúdo fica junto do seu ciclo de estudo.</p></div>
      <button className="k-button k-button-primary" onClick={createNote} data-testid="button-new-note"><NotebookPen size={14} /> Nova nota</button>
    </div>
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="k-card overflow-hidden">
        <div className="border-b border-[#29313d] px-4 py-3"><p className="k-eyebrow">suas notas</p><p className="mt-1 text-[11px] text-[#8e98a8]">{notes.length} documentos no workspace</p></div>
        <div className="k-notes-list">
          {notes.map((note) => <button key={note.id} className={`k-note-row ${selectedId === note.id ? 'k-note-row-active' : ''}`} onClick={() => selectNote(note.id)} data-testid={`button-note-${note.id}`}><span className="flex min-w-0 items-start gap-3"><NotebookPen size={14} className="mt-0.5 shrink-0" /><span className="min-w-0 text-left"><span className="block truncate text-[12px] font-semibold">{note.title}</span><span className="mt-1 block text-[10px] text-[#8e98a8]">{note.subject} · {note.updatedAt}</span></span></span></button>)}
        </div>
      </aside>
      <section className="k-card overflow-hidden">
        {!selectedNote ? <div className="flex min-h-[480px] flex-col items-center justify-center p-8 text-center"><NotebookPen size={22} className="k-focus" /><p className="mt-4 text-[14px] font-semibold">Comece uma nota</p><p className="mt-2 max-w-[340px] text-[11px] leading-5 text-[#8e98a8]">Registre uma ideia ou transforme um tópico do edital em explicação.</p><button className="k-button k-button-primary mt-5" onClick={createNote}>Criar primeira nota</button></div> : <><div className="flex flex-col gap-3 border-b border-[#29313d] p-4 md:flex-row md:items-center md:justify-between"><input className="k-note-title flex-1" value={draftTitle} onChange={(event) => { setDraftTitle(event.target.value); setSaved(false); }} aria-label="Título da nota" /><div className="flex items-center gap-2"><div className="k-note-view-toggle"><button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')} data-testid="button-note-edit">Editar</button><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')} data-testid="button-note-preview">Visualizar</button></div><button className="k-button k-button-primary" onClick={saveNote} data-testid="button-save-note"><Check size={14} /> {saved ? 'Salvo' : 'Salvar'}</button></div></div><div className="border-b border-[#29313d] px-4 py-2"><span className="k-mono text-[10px] text-[#8e98a8]">Markdown · {selectedNote.subject}</span></div>{view === 'edit' ? <textarea className="k-markdown-editor" value={draftContent} onChange={(event) => { setDraftContent(event.target.value); setSaved(false); }} aria-label="Conteúdo da nota" data-testid="textarea-note-content" /> : <div className="min-h-[470px] p-5 md:p-8"><MarkdownPreview content={draftContent} /></div>}<div className="flex items-center justify-between border-t border-[#29313d] px-4 py-3 text-[10px] text-[#8e98a8]"><span>Salvo localmente no navegador</span><span>{draftContent.length} caracteres</span></div></>}
      </section>
    </div>
  </div>;
}

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
        <Route path="/edital" component={Edital} />
        <Route path="/estudo" component={Study} />
        <Route path="/notas" component={() => <Notes notes={notes} onCreateNote={createNote} onSaveNote={saveNote} />} />
        <Route path="/revisao" component={() => <Review cards={cards} onGrade={gradeCard} />} />
        <Route path="/questoes" component={() => <Questions onRegisterError={registerError} />} />
        <Route path="/erros" component={() => <Errors errors={errors} />} />
        <Route path="/recomendacoes" component={() => <Recommendations recommendations={recommendations} plan={plan} onApprove={approveRecommendation} />} />
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
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
