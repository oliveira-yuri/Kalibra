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

import { EditalUploadProgress } from './components/EditalUploadProgress';

function Edital({ workspaceSlug }: { workspaceSlug: string }) {
  const { user } = useUser();
  const [subjectFilter, setSubjectFilter] = useState('Todas');
  const [priorityFilter, setPriorityFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<'file' | 'text'>('file');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [updateSaved, setUpdateSaved] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [practiceTopic, setPracticeTopic] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleRegisterPractice = (topicId: string, total: number, correct: number) => {
    const topic = topics.find(t => t.id === topicId);
    const percent = Math.round((correct / total) * 100);
    toast({ description: `${total} questões registradas em ${topic?.name.split(' ')[0]} · ${percent}%` });
    setPracticeTopic(null);
  };

  const saveEditalUpdate = () => {
    if (sourceMode === 'file' && !sourceFileName) {
      setUpdateError('Selecione um arquivo antes de continuar.');
      return;
    }
    if (sourceMode === 'text' && !sourceText.trim()) {
      setUpdateError('Cole o conteúdo atualizado do edital antes de continuar.');
      return;
    }
    setUpdateError('');
    setIsProcessing(true);
  };
  
  const handleReady = () => {
    stageWorkspaceImport(workspaceSlug, {
      isNew: false,
      updates: {
        sourceMode,
        sourceFileName: sourceMode === 'file' ? sourceFileName : undefined,
        sourceText: sourceMode === 'text' ? sourceText : undefined,
        importStatus: 'pending',
        nextAction: 'Edital atualizado · aguardando revisão',
      },
    }, user?.id);
    setIsUpdateModalOpen(false);
    setIsProcessing(false);
    setSourceFileName('');
    setSourceText('');
    setLocation('/edital/revisar/2');
  };
  
  const filtered = topics.filter((topic) => (subjectFilter === 'Todas' || topic.subject === subjectFilter) && (priorityFilter === 'todas' || topic.priority === priorityFilter) && (statusFilter === 'todos' || topic.status === statusFilter));
  
  return <div className="space-y-5">
    {isUpdateModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
        <div className="k-card w-full max-w-md p-6 relative">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Atualizar Edital</h3>
            <button className="k-icon-button k-button-quiet" onClick={() => setIsUpdateModalOpen(false)} disabled={isProcessing}><X size={16} /></button>
          </div>
          
          {isProcessing ? (
            <div className="-mx-6">
              <EditalUploadProgress onReady={handleReady} onCancel={() => setIsProcessing(false)} />
            </div>
          ) : (
            <>
              <p className="mb-6 text-[13px] text-[#8e98a8]">Envie a nova versão agora. A análise e a mesclagem dos tópicos serão realizadas pelo backend quando essa integração estiver conectada.</p>
              {updateError && <p className="mb-4 border border-[#db8f83] bg-[#fff0ee] p-3 text-[12px] text-[#c94f45] dark:bg-[#30201f] dark:text-[#ff907d]">{updateError}</p>}
              
              <div className="mb-6 flex gap-1 p-1 rounded-[4px] bg-[#f1f4f2] dark:bg-[#0b0e13] border border-[#dfe6e4] dark:border-[#242a34]">
                <button onClick={() => setSourceMode('file')} className={`flex-1 flex justify-center py-2 text-[12px] font-medium rounded-[3px] transition-colors ${sourceMode === 'file' ? 'bg-white dark:bg-[#202b20] text-[#16232b] dark:text-[#d5f35b] shadow-sm border border-[#d5dede] dark:border-[#35404e]' : 'text-[#6f7b85] dark:text-[#8e98a8]'}`}>Arquivo</button>
                <button onClick={() => setSourceMode('text')} className={`flex-1 flex justify-center py-2 text-[12px] font-medium rounded-[3px] transition-colors ${sourceMode === 'text' ? 'bg-white dark:bg-[#202b20] text-[#16232b] dark:text-[#d5f35b] shadow-sm border border-[#d5dede] dark:border-[#35404e]' : 'text-[#6f7b85] dark:text-[#8e98a8]'}`}>Texto</button>
              </div>

              {sourceMode === 'file' ? (
                <div className="relative mb-6">
                  <input type="file" accept=".pdf,.docx,.txt" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setSourceFileName('');
                      setUpdateError('O arquivo deve ter no máximo 5 MB.');
                      e.target.value = '';
                      return;
                    }
                    setUpdateError('');
                    setSourceFileName(file.name);
                  }} />
                  <div className={`flex flex-col items-center justify-center py-8 px-4 rounded-[4px] border-2 border-dashed text-center ${sourceFileName ? 'border-[#6aa17b] bg-[#edf8ef] dark:border-[#80d8a5] dark:bg-[#172c26]' : 'border-[#d5dede] dark:border-[#35404e]'}`}>
                    {sourceFileName ? (
                      <><CheckCircle2 size={24} className="text-[#23824d] dark:text-[#80d8a5] mb-2" /><p className="text-[13px] font-medium">{sourceFileName}</p></>
                    ) : (
                      <><UploadCloud size={24} className="text-[#8e98a8] mb-2" /><p className="text-[13px] font-medium">Selecione o novo edital</p></>
                    )}
                  </div>
                </div>
              ) : (
                <textarea className="k-input min-h-[150px] mb-6 resize-y text-[12px]" placeholder="Cole o conteúdo programático atualizado..." value={sourceText} onChange={(event) => setSourceText(event.target.value)} />
              )}

              <div className="flex justify-end gap-3">
                <button className="k-button k-button-quiet" onClick={() => setIsUpdateModalOpen(false)}>Cancelar</button>
                <button className="k-button k-button-primary" onClick={saveEditalUpdate}>Salvar nova versão</button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="k-eyebrow mb-2">estrutura da prova · 84 tópicos mapeados</p><h2 className="text-[26px] font-semibold tracking-[-0.045em]">Edital em estado de estudo</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Use o status como decisão de próxima sessão, não como checklist decorativo.</p></div><div className="flex items-center gap-3"><button className="k-button" data-testid="button-import-syllabus" onClick={() => setIsUpdateModalOpen(true)}><UploadCloud size={14} /> Atualizar edital</button><button className="k-button" data-testid="button-export-syllabus"><FileText size={14} /> Exportar recorte</button></div></div><div className="k-card flex flex-col gap-3 p-3 md:flex-row"><div className="flex items-center gap-2 text-[11px] text-[#8e98a8]"><Filter size={14} /> filtros ativos</div><select className="k-input md:w-[210px]" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} data-testid="select-subject-filter"><option>Todas</option>{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select><select className="k-input md:w-[145px]" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} data-testid="select-priority-filter"><option value="todas">Prioridade</option><option value="alta">Alta</option><option value="média">Média</option><option value="baixa">Baixa</option></select><select className="k-input md:w-[165px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} data-testid="select-status-filter"><option value="todos">Todos os status</option><option value="dominar">Dominar</option><option value="em andamento">Em andamento</option><option value="não iniciado">Não iniciado</option></select><span className="ml-auto hidden items-center gap-2 px-2 text-[10px] text-[#8e98a8] md:flex"><span className="h-2 w-2 rounded-full bg-[#d5f35b]" />{filtered.length} tópicos</span></div><div className="k-card overflow-hidden"><div className="hidden grid-cols-[1.2fr_1.5fr_.7fr_.7fr_.8fr_70px] gap-4 bg-[#131820] px-5 py-3 text-[10px] uppercase tracking-[.1em] text-[#697587] md:grid"><span>matéria</span><span>tópico</span><span>prioridade</span><span>acerto</span><span>status</span><span /></div>{filtered.map((topic) => <div key={topic.id} className="k-table-row grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1.5fr_.7fr_.7fr_.8fr_70px] md:items-center md:gap-4" data-testid={`row-topic-${topic.id}`}><div><span className="text-[11px] text-[#aeb8c5]">{topic.subject}</span><span className="mt-1 block text-[10px] text-[#647080]">{topic.lastStudied}</span></div><div><Link href="/estudo" className="text-[12px] font-medium hover:text-[#d5f35b]" data-testid={`link-topic-${topic.id}`}>{topic.name}</Link><div className="mt-2 k-progress md:max-w-[180px]"><span style={{ width: `${Math.max(topic.accuracy, 3)}%`, background: topic.accuracy < 55 ? '#ff907d' : '#d5f35b' }} /></div></div><span className={`k-chip w-fit ${topic.priority === 'alta' ? 'border-[#75433e] text-[#ff907d]' : ''}`}>{topic.priority}</span><span className={`k-mono text-[12px] ${topic.accuracy < 55 ? 'k-coral' : 'text-[#b9c4d0]'}`}>{topic.accuracy ? `${topic.accuracy}%` : '—'}</span><span className={`w-fit text-[10px] ${topic.status === 'dominar' ? 'text-[#8ed9ae]' : topic.status === 'em andamento' ? 'text-[#d5f35b]' : 'text-[#8e98a8]'}`}>{topic.status}</span>
    <div className="flex items-center gap-1 justify-end relative">
      <button className="k-button k-button-quiet k-icon-button" onClick={() => setPracticeTopic(topic.id)} aria-label={`Registrar prática para ${topic.name}`} title="Registrar prática"><CheckCircle2 size={15} className="opacity-50 hover:opacity-100" /></button>
      <button className="k-button k-button-quiet k-icon-button" data-testid={`button-topic-menu-${topic.id}`} aria-label={`Ações para ${topic.name}`}><MoreHorizontal size={15} /></button>
      {practiceTopic === topic.id && <QuickPracticeRegistro topics={topics} defaultTopicId={topic.id} onClose={() => setPracticeTopic(null)} onRegister={handleRegisterPractice} />}
    </div>
  </div>)}</div></div>;
}

function Study() {
  const [tab, setTab] = useState('explicação');
  const [complete, setComplete] = useState(false);
  const tabs = [
    { id: 'explicação', label: 'explicação' }, 
    { id: 'flashcards', label: 'cards anki' }, 
    { id: 'questões', label: 'questões' }, 
    { id: 'dissertativa', label: 'dissertativa' }, 
    { id: 'resumo', label: 'resumo' }, 
    { id: 'erros', label: 'erros' }
  ];
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 border-b border-[#29313d] pb-5 md:flex-row md:items-end"><div><div className="mb-3 flex items-center gap-2"><span className="k-chip k-chip-active">MATEMÁTICA</span><span className="k-chip">PRIORIDADE ALTA</span></div><h2 className="text-[28px] font-semibold tracking-[-0.05em]">Porcentagem e juros simples</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Sessão guiada · última prática há 5 dias · acerto atual 47%</p></div><div className="flex gap-2"><button className={`k-button ${complete ? 'border-[#8ed9ae] text-[#8ed9ae]' : 'k-button-primary'}`} onClick={() => setComplete(!complete)} data-testid="button-complete-study">{complete ? <CheckCircle2 size={14} /> : <Check size={14} />} {complete ? 'Sessão registrada' : 'Marcar como estudado'}</button><Link href="/questoes" className="k-button" data-testid="link-study-questions"><Play size={14} /> Praticar</Link></div></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]"><section className="k-card overflow-hidden"><div className="flex gap-1 overflow-x-auto border-b border-[#29313d] p-2">{tabs.map((item) => <button key={item.id} className={`k-button whitespace-nowrap border-0 px-3 text-[11px] capitalize ${tab === item.id ? 'bg-[#283322] text-[#d5f35b]' : 'k-button-quiet'}`} onClick={() => setTab(item.id)} data-testid={`button-study-tab-${item.id}`}>{item.label}</button>)}</div><div className="p-5 md:p-8">{tab === 'explicação' && <article className="prose prose-invert max-w-none prose-headings:tracking-[-.04em] prose-p:text-[13px] prose-p:leading-7 prose-p:text-[#b8c1cc]"><p className="k-eyebrow not-prose">base para resolver</p><h3>Porcentagem é uma razão com denominador 100</h3><p>Quando uma grandeza varia em porcentagem, o valor percentual funciona como um fator de transformação. O caminho mais seguro é sempre escrever o fator antes de calcular.</p><div className="not-prose my-5 border-l-2 border-[#d5f35b] bg-[#1b241e] p-4"><p className="k-mono text-[13px] text-[#d5f35b]">valor final = valor inicial × (1 ± taxa/100)</p><p className="mt-2 text-[11px] text-[#aeb8c5]">Use + para aumento e − para redução.</p></div><h3>Exemplo de prova</h3><p>Uma taxa de inscrição de R$ 80 sofreu reajuste de 12,5%. O acréscimo é 80 × 0,125 = R$ 10. O valor final é R$ 90.</p><div className="not-prose mt-6 grid gap-3 sm:grid-cols-2"><div className="k-card-soft p-4"><p className="k-eyebrow mb-2">atenção</p><p className="text-[12px] leading-5 text-[#d7dde4]">Não some a taxa ao número sem antes converter a porcentagem para fator.</p></div><div className="k-card-soft p-4"><p className="k-eyebrow mb-2">checagem rápida</p><p className="text-[12px] leading-5 text-[#d7dde4]">Em redução, o resultado precisa ser menor que o valor inicial.</p></div></div></article>}{tab === 'flashcards' && <Flashcards />}{tab === 'questões' && <div className="flex flex-col items-start gap-4"><p className="k-eyebrow">prática deliberada</p><h3 className="text-[19px] font-semibold">Teste o procedimento antes de avançar</h3><p className="max-w-[530px] text-[13px] leading-6 text-[#aeb8c5]">O próximo bloco tem 8 questões com mistura de cálculo direto e interpretação de enunciado.</p><Link href="/questoes" className="k-button k-button-primary" data-testid="link-open-practice-from-study">Abrir bloco de questões <ArrowRight size={14} /></Link></div>}{tab === 'dissertativa' && <Dissertativa />}{tab === 'resumo' && <Summary />}{tab === 'erros' && <div className="space-y-3"><p className="k-eyebrow">erros relacionados ao tópico</p><div className="k-card-soft p-4"><p className="text-[12px] font-medium">Aplicou 15% como 0,15 no lugar de 1,15</p><p className="mt-2 text-[11px] text-[#8e98a8]">falha de procedimento · 12 dez 2025 · aberto</p></div><Link href="/erros" className="k-button k-button-quiet px-0 text-[11px]" data-testid="link-all-study-errors">Ver no caderno de erros <ArrowRight size={13} /></Link></div>}</div></section><aside className="space-y-3"><div className="k-card p-4"><p className="k-eyebrow mb-4">estado do tópico</p><div className="mb-3 flex items-end justify-between"><span className="k-mono text-[29px] text-[#ff907d]">47%</span><span className="text-[10px] text-[#8e98a8]">acerto</span></div><div className="k-progress"><span className="bg-[#ff907d]" style={{ width: '47%', background: '#ff907d' }} /></div><div className="mt-4 flex justify-between text-[10px] text-[#8e98a8]"><span>corte recomendado</span><span className="k-mono text-[#d5f35b]">70%</span></div></div><div className="k-card p-4"><p className="k-eyebrow mb-3">nesta sessão</p><div className="space-y-3 text-[11px]"><div className="flex justify-between"><span className="text-[#8e98a8]">tempo estimado</span><span className="k-mono">25 min</span></div><div className="flex justify-between"><span className="text-[#8e98a8]">questões pendentes</span><span className="k-mono">8</span></div><div className="flex justify-between"><span className="text-[#8e98a8]">revisão seguinte</span><span className="k-mono">20 dez</span></div></div></div><div className="k-card-soft p-4"><div className="flex gap-2"><Brain size={15} className="k-focus shrink-0" /><p className="text-[11px] leading-5 text-[#b8c1cc]">O diagnóstico sugere alternar explicação curta com prática imediata.</p></div></div></aside></div></div>;
}

function Dissertativa() {
  const [text, setText] = useState('');
  const [evaluated, setEvaluated] = useState(false);
  const lines = text.split('\n').length;
  
  return (
    <div className="space-y-6">
      <div className="mb-4">
        <p className="k-eyebrow mb-2">QUESTÃO TEÓRICO-PRÁTICA</p>
        <p className="text-[14px] leading-relaxed">
          Discorra sobre a aplicação de juros simples no sistema financeiro, abordando seu conceito básico e comparando brevemente seu impacto em relação a juros compostos em períodos curtos.
        </p>
      </div>
      
      {!evaluated ? (
        <div className="animate-in fade-in">
          <p className="text-[12px] text-[#8e98a8] mb-3">Escreva à mão, em papel, respeitando o limite de linhas. Depois transcreva aqui para receber a avaliação.</p>
          <textarea 
            className="k-input min-h-[280px] resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sua resposta dissertativa transcrita..."
          />
          <div className="mt-4 flex items-center justify-between">
            <span className={`text-[12px] ${lines < 10 ? 'text-[#ff907d]' : 'text-[#8e98a8]'}`}>linhas escritas: {text.trim() ? lines : 0} / 30</span>
            <button className="k-button k-button-primary" onClick={() => setEvaluated(true)} disabled={!text.trim()}>Avaliar</button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in border border-[#394452] dark:border-[#35404e] bg-white dark:bg-[#131821] p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[18px] font-semibold">Avaliação</h3>
            <span className="k-mono text-[20px] text-[#6b8d00] dark:text-[#d5f35b] font-bold">7,5 / 10</span>
          </div>
          
          <div className="space-y-5">
            <div className="border-t border-[#d5dede] dark:border-[#29313d] pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[13px]">Tema</span>
                <span className="k-mono text-[13px] text-[#6f7b85] dark:text-[#8e98a8]">4,0 / 5,0</span>
              </div>
              <ul className="text-[12px] text-[#6f7b85] dark:text-[#8e98a8] pl-4 list-disc space-y-1">
                <li>atende parcialmente ao problema</li>
              </ul>
            </div>
            
            <div className="border-t border-[#d5dede] dark:border-[#29313d] pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[13px]">Estrutura do período e parágrafo</span>
                <span className="k-mono text-[13px] text-[#6f7b85] dark:text-[#8e98a8]">2,0 / 2,5</span>
              </div>
              <ul className="text-[12px] text-[#6f7b85] dark:text-[#8e98a8] pl-4 list-disc space-y-1">
                <li>poucas falhas de progressão</li>
              </ul>
            </div>
            
            <div className="border-t border-[#d5dede] dark:border-[#29313d] pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[13px]">Domínio do estilo formal</span>
                <span className="k-mono text-[13px] text-[#6f7b85] dark:text-[#8e98a8]">1,5 / 2,5</span>
              </div>
              <ul className="text-[12px] text-[#6f7b85] dark:text-[#8e98a8] pl-4 list-disc space-y-1">
                <li>concordância no 2º parágrafo</li>
                <li>crase indevida antes de verbo</li>
                <li>acentuação: "critérios"</li>
              </ul>
            </div>
          </div>
          <button className="k-button k-button-quiet mt-6 w-full text-[12px]" onClick={() => setEvaluated(false)}>Voltar ao texto</button>
        </div>
      )}
    </div>
  );
}

function Flashcards() {
  const [cards, setCards] = useState([
    { id: 'a1', status: 'rascunho', text: 'Qual é o fator de um aumento de 18%?', detail: '' },
    { id: 'a2', status: 'aprovado', text: 'Em redução, o resultado é maior ou menor?', detail: '' },
    { id: 'a3', status: 'exportado', text: 'Como aplicar duas variações seguidas?', detail: 'há 2 dias' },
  ]);
  const approve = (id: string) => setCards((current) => current.map((card) => card.id === id ? { ...card, status: 'aprovado' } : card));
  const generate = () => setCards((current) => [...current, { id: `a${Date.now()}`, status: 'rascunho', text: 'Qual erro de procedimento devo evitar neste tópico?', detail: '' }]);
  return (
    <div>
      <p className="k-eyebrow mb-5">CARDS DESTE TÓPICO</p>
      <div className="space-y-2">
        {cards.map((card) => <div key={card.id} className={`flex items-center gap-3 p-3 border transition-colors group ${card.status === 'exportado' ? 'bg-[#f5f8f6] dark:bg-[#0b0e13] border-[#dfe6e4] dark:border-[#242a34]' : 'bg-white dark:bg-[#131821] border-[#d5dede] dark:border-[#29313d]'}`}>
          {card.status === 'rascunho' ? <CircleDot size={14} className="text-[#8e98a8] shrink-0" /> : card.status === 'aprovado' ? <Check size={14} className="text-[#6b8d00] dark:text-[#d5f35b] shrink-0" /> : <ArrowRight size={14} className="text-[#8e98a8] shrink-0 -rotate-45" />}
          <span className={`text-[10px] w-[70px] uppercase font-mono tracking-wider ${card.status === 'aprovado' ? 'text-[#6b8d00] dark:text-[#d5f35b]' : 'text-[#8e98a8]'}`}>{card.status}</span>
          <span className={`text-[12px] flex-1 truncate ${card.status === 'exportado' ? 'text-[#8e98a8]' : ''}`}>{card.text}</span>
          {card.status === 'rascunho' && <button className="k-button k-button-quiet !h-6 !text-[10px] !px-2 opacity-50 group-hover:opacity-100" onClick={() => approve(card.id)}>aprovar</button>}
          {card.detail && <span className="text-[10px] text-[#8e98a8]">{card.detail}</span>}
        </div>)}
      </div>
      
      <div className="mt-5 text-right">
        <button className="k-button k-button-quiet text-[11px]" onClick={generate}><Plus size={14} /> Gerar card a partir de um erro</button>
      </div>
    </div>
  );
}

function Summary() {
  return <div><p className="k-eyebrow mb-5">resumo operacional</p><div className="space-y-3"><div className="k-card-soft p-4"><p className="k-mono text-[12px] text-[#d5f35b]">01 / fator</p><p className="mt-2 text-[13px] text-[#d7dde4]">Aumento → 1 + taxa. Redução → 1 − taxa.</p></div><div className="k-card-soft p-4"><p className="k-mono text-[12px] text-[#d5f35b]">02 / ordem</p><p className="mt-2 text-[13px] text-[#d7dde4]">Converta a porcentagem, aplique ao valor e confira a direção da mudança.</p></div><div className="k-card-soft p-4"><p className="k-mono text-[12px] text-[#d5f35b]">03 / prova</p><p className="mt-2 text-[13px] text-[#d7dde4]">Quando houver duas variações seguidas, aplique um fator depois do outro.</p></div></div></div>;
}

function Review({ cards, onGrade }: { cards: ReviewCard[]; onGrade: (id: string, difficulty: Difficulty) => void }) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [writtenText, setWrittenText] = useState('');
  const [wroteByHand, setWroteByHand] = useState(false);
  
  const card = cards[index % cards.length];
  // Find a note for this topic, or mock one
  const note = initialNotes.find(n => n.title.includes(card.topic)) || initialNotes[0];

  const grade = (level: string, days: number) => { 
    // Just map to the existing difficulties for prototype
    const difficultyMap: Record<string, Difficulty> = {
      'Nada': 'errei',
      'Parcial': 'difícil',
      'Bom': 'bom',
      'Completo': 'fácil'
    };
    onGrade(card.id, difficultyMap[level]); 
    setStep(1);
    setWrittenText('');
    setWroteByHand(false);
    setIndex((index + 1) % cards.length); 
  };
  
  return (
    <div className="mx-auto max-w-[1050px] space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="k-eyebrow mb-2">revisão {index + 1} / {cards.length}</p>
          <h2 className="text-[20px] font-semibold tracking-[-.05em]">{note.subject} · {card.topic}</h2>
        </div>
      </div>

      <section className="k-card p-6 md:p-8">
        {step === 1 ? (
          <div className="animate-in fade-in">
            <p className="text-[14px] mb-4">Escreva, sem consultar nada, o que você lembra deste tópico.</p>
            <textarea 
              className="k-input min-h-[220px] resize-y" 
              placeholder="O que vem à mente..."
              value={writtenText}
              onChange={e => setWrittenText(e.target.value)}
            />
            <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-[12px] text-[#6f7b85] dark:text-[#8e98a8]">
                <input type="checkbox" checked={wroteByHand} onChange={e => setWroteByHand(e.target.checked)} />
                Escrevi à mão antes de transcrever
              </label>
              <button 
                className="k-button k-button-primary"
                onClick={() => setStep(2)}
                disabled={!writtenText.trim() && !wroteByHand}
              >
                Revelar minha nota
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in space-y-8">
            <div className="grid md:grid-cols-2 gap-6 border-b border-[#29313d] pb-8">
              <div>
                <p className="k-eyebrow mb-4">O que você escreveu</p>
                <div className="p-4 bg-[#f1f4f2] dark:bg-[#131821] border border-[#dfe6e4] dark:border-[#29313d] min-h-[200px] whitespace-pre-wrap text-[12px]">
                  {writtenText || (wroteByHand ? "(Prática manuscrita não transcrita)" : "")}
                </div>
              </div>
              <div>
                <p className="k-eyebrow mb-4">Sua nota de referência</p>
                <div className="p-4 bg-white dark:bg-[#1a2029] border border-[#d5dede] dark:border-[#35404e] min-h-[200px] text-[12px] prose prose-invert max-w-none prose-sm">
                  {note ? <MarkdownPreview content={note.content} /> : (
                    <div className="text-center mt-10 text-[#8e98a8]">
                      <p>Nenhuma nota salva para este tópico.</p>
                      <button className="k-button k-button-quiet mt-2">Criar nota</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[14px] font-medium mb-4 text-center">O quanto você recuperou?</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="k-card-soft hover:border-[#db8f83] dark:hover:border-[#ff907d] p-3 text-center transition-colors group" onClick={() => grade('Nada', 1)}>
                  <div className="font-semibold text-[13px] mb-1">Nada</div>
                  <div className="k-mono text-[9px] text-[#6f7b85] dark:text-[#8e98a8] group-hover:text-[#c94f45] dark:group-hover:text-[#ff907d]">próxima em 1 dia</div>
                </button>
                <button className="k-card-soft hover:border-[#c99a6e] dark:hover:border-[#ffb28a] p-3 text-center transition-colors group" onClick={() => grade('Parcial', 3)}>
                  <div className="font-semibold text-[13px] mb-1">Parcial</div>
                  <div className="k-mono text-[9px] text-[#6f7b85] dark:text-[#8e98a8] group-hover:text-[#b76b21] dark:group-hover:text-[#ffb28a]">próxima em 3 dias</div>
                </button>
                <button className="k-card-soft hover:border-[#80d8a5] dark:hover:border-[#8ed9ae] p-3 text-center transition-colors group" onClick={() => grade('Bom', 16)}>
                  <div className="font-semibold text-[13px] mb-1">Bom</div>
                  <div className="k-mono text-[9px] text-[#6f7b85] dark:text-[#8e98a8] group-hover:text-[#23824d] dark:group-hover:text-[#8ed9ae]">próxima em 16 dias</div>
                </button>
                <button className="k-card-soft hover:border-[#6b8d00] dark:hover:border-[#d5f35b] p-3 text-center transition-colors group" onClick={() => grade('Completo', 35)}>
                  <div className="font-semibold text-[13px] mb-1">Completo</div>
                  <div className="k-mono text-[9px] text-[#6f7b85] dark:text-[#8e98a8] group-hover:text-[#5f7900] dark:group-hover:text-[#d5f35b]">próxima em 35 dias</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Questions({ onRegisterError }: { onRegisterError: (question: Question) => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'Baixa' | 'Média' | 'Alta' | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timed, setTimed] = useState(false);
  const question = questions[index];
  
  const answer = (option: number) => { 
    setSelected(option); 
    // Ask for confidence before feedback
  };
  
  const confirmConfidence = (level: 'Baixa' | 'Média' | 'Alta') => {
    setConfidence(level);
    setShowFeedback(true);
  };
  
  const next = () => { 
    setIndex((index + 1) % questions.length); 
    setSelected(null); 
    setConfidence(null);
    setShowFeedback(false); 
  };
  
  const correct = selected === question.correct;
  
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="k-eyebrow mb-2">prática · sessão diagnóstica</p><h2 className="text-[27px] font-semibold tracking-[-.05em]">Questões que devolvem sinal.</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Resolva, classifique o erro e deixe o próximo passo mais preciso.</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-[11px] text-[#8e98a8]"><input type="checkbox" checked={timed} onChange={(event) => setTimed(event.target.checked)} data-testid="input-timed-mode" /> <Timer size={14} /> cronômetro</label><span className="k-chip">{index + 1} / {questions.length}</span></div></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]"><section className="k-card p-5 md:p-8"><div className="mb-7 flex flex-wrap items-center gap-2"><span className="k-chip k-chip-active">{question.subject}</span><span className="k-chip">{question.topic}</span><span className="ml-auto text-[10px] text-[#6f7b8b]">{question.source}</span></div><h3 className="max-w-[760px] text-[20px] font-medium leading-8 tracking-[-.025em]">{question.stem}</h3><div className="mt-7 space-y-2">{question.options.map((option, optionIndex) => { const state = showFeedback ? optionIndex === question.correct ? 'k-option-correct' : selected === optionIndex ? 'k-option-wrong' : '' : selected === optionIndex ? 'k-option-selected' : ''; return <button key={option} disabled={showFeedback || (selected !== null && selected !== optionIndex)} className={`k-option flex w-full items-start gap-3 p-3 text-left text-[12px] ${state} ${(selected !== null && !showFeedback && selected !== optionIndex) ? 'opacity-50' : ''}`} onClick={() => answer(optionIndex)} data-testid={`button-option-${optionIndex}`}><span className="k-mono flex h-5 w-5 shrink-0 items-center justify-center border border-[#455161] text-[10px] text-[#aeb8c5]">{String.fromCharCode(65 + optionIndex)}</span><span className="pt-0.5">{option}</span>{showFeedback && optionIndex === question.correct && <Check size={15} className="ml-auto text-[#8ed9ae]" />}</button> })}</div>
  
  {selected !== null && !showFeedback && (
    <div className="mt-5 border border-[#d5dede] bg-[#f8faf9] p-4 text-center text-[#16232b] dark:border-[#394452] dark:bg-[#131821] dark:text-[#f0f0e8] animate-in fade-in zoom-in-95">
      <p className="text-[12px] font-medium mb-3">Qual sua confiança nesta resposta?</p>
      <div className="flex justify-center gap-3">
        <button className="k-chip hover:bg-[#e9efed] dark:hover:bg-[#202b20] cursor-pointer w-24 text-center" onClick={() => confirmConfidence('Baixa')}>Baixa</button>
        <button className="k-chip hover:bg-[#e9efed] dark:hover:bg-[#202b20] cursor-pointer w-24 text-center" onClick={() => confirmConfidence('Média')}>Média</button>
        <button className="k-chip hover:bg-[#e9efed] dark:hover:bg-[#202b20] cursor-pointer w-24 text-center" onClick={() => confirmConfidence('Alta')}>Alta</button>
      </div>
    </div>
  )}

  {showFeedback && <div className={`mt-5 border p-4 ${correct ? 'border-[#526d39] bg-[#1d2a1d]' : 'border-[#75433e] bg-[#30201f]'}`} data-testid="status-question-feedback"><div className="flex items-center gap-2 text-[12px] font-semibold">{correct ? <CheckCircle2 size={15} className="text-[#8ed9ae]" /> : <CircleAlert size={15} className="k-coral" />}{correct ? 'Resposta correta' : 'Resposta incorreta'}<span className="ml-auto text-[10px] font-normal text-[#8e98a8]">você respondeu com confiança {confidence?.toLowerCase()}</span></div><p className="mt-2 text-[12px] leading-5 text-[#b8c1cc]">{question.explanation}</p></div>}
  
  {showFeedback && !correct && confidence === 'Alta' && (
    <div className="mt-2 p-3 bg-[#fff0ee] dark:bg-[#30201f] border border-[#db8f83] dark:border-[#ff907d] text-[#c94f45] dark:text-[#ff907d] text-[11px] font-bold rounded-sm text-center uppercase tracking-wider flex items-center justify-center gap-2">
      <AlertCircle size={14} /> Erro com convicção — prioridade máxima de revisão.
    </div>
  )}

  <div className="mt-7 flex flex-wrap justify-between gap-2 border-t border-[#29313d] pt-5"><button className="k-button k-button-quiet" onClick={() => { setSelected(null); setConfidence(null); setShowFeedback(false); }} data-testid="button-reset-question"><RotateCcw size={14} /> Limpar resposta</button><div className="flex gap-2">{showFeedback && !correct && <button className="k-button text-[#ff907d]" onClick={() => onRegisterError(question)} data-testid="button-register-error"><Flag size={14} /> Registrar erro</button>}<button className="k-button k-button-primary" onClick={next} disabled={!showFeedback} data-testid="button-next-question">Próxima questão <ArrowRight size={14} /></button></div></div></section><aside className="space-y-3"><div className="k-card p-5"><p className="k-eyebrow mb-4">sessão atual</p><div className="grid grid-cols-2 gap-3"><div><p className="k-mono text-[25px] text-[#d5f35b]">02</p><p className="mt-1 text-[10px] text-[#8e98a8]">acertos</p></div><div><p className="k-mono text-[25px] text-[#ff907d]">01</p><p className="mt-1 text-[10px] text-[#8e98a8]">a revisar</p></div></div><div className="mt-5 k-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div></div><div className="k-card-soft p-4"><p className="k-eyebrow mb-2">classifique depois</p><p className="text-[11px] leading-5 text-[#aeb8c5]">Registrar o erro abre uma linha no caderno e alimenta as recomendações — sem alterar o ciclo automaticamente.</p></div></aside></div></div>;
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
        <Route path="/estudo" component={Study} />
        <Route path="/notas" component={() => <Notes notes={notes} onCreateNote={createNote} onSaveNote={saveNote} />} />
        <Route path="/revisao" component={() => <Review cards={cards} onGrade={gradeCard} />} />
        <Route path="/questoes" component={() => <Questions onRegisterError={registerError} />} />
        <Route path="/erros" component={() => <Errors errors={errors} />} />
        <Route path="/recomendacoes" component={() => <Recommendations recommendations={recommendations} plan={plan} onApprove={approveRecommendation} />} />
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
