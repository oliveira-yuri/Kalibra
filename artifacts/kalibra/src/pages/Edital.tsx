import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  CheckCircle2, FileText, Filter, MoreHorizontal, UploadCloud, X,
} from 'lucide-react';
import { EditalUploadProgress } from '@/components/EditalUploadProgress';
import { QuickPracticeRegistro } from '@/components/QuickPracticeRegistro';
import { stageWorkspaceImport } from '@/domain/useWorkspaces';
import { subjects, topics } from '@/data';
import { useToast } from '@/hooks/use-toast';

export function Edital({ workspaceSlug }: { workspaceSlug: string }) {
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
                    if (file.size > 20 * 1024 * 1024) {
                      setSourceFileName('');
                      setUpdateError('O arquivo deve ter no máximo 20 MB.');
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
