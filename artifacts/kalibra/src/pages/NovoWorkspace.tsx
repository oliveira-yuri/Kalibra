import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, ArrowLeft, UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useUser } from '@clerk/react';
import { stageWorkspaceImport, useWorkspaces, defaultCargo, WorkspaceDraft, type Cargo } from '@/domain/useWorkspaces';
import { emptyAvailability, validateAvailability, nextActionFor, uniqueSlug } from '@workspace/core';
import { EditalUploadProgress } from '@/components/EditalUploadProgress';
import { CargoFields } from '@/components/CargoFields';
import { AvailabilityFields } from '@/components/AvailabilityFields';

export function NovoWorkspace({ theme, onToggleTheme }: { theme: 'light' | 'dark', onToggleTheme: () => void }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { workspaces, addWorkspace } = useWorkspaces(user?.id);

  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState('Concurso Público');
  const [examDate, setExamDate] = useState('');
  const [cargos, setCargos] = useState<Cargo[]>([{ id: 'c1', name: '', examDate: '', period: '' }]);
  const [availability, setAvailability] = useState(emptyAvailability());
  const [sourceMode, setSourceMode] = useState<'file' | 'text' | 'none'>('file');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [error, setError] = useState('');
  const [availabilityProblems, setAvailabilityProblems] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdSlug, setCreatedSlug] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setSourceFileName('');
        setError('O arquivo deve ter no máximo 20 MB.');
        e.target.value = '';
        return;
      }
      setError('');
      setSourceFileName(file.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !institution || !examDate) {
      setError('Preencha os campos obrigatórios (título, instituição, data).');
      setAvailabilityProblems([]);
      return;
    }
    if (sourceMode === 'file' && !sourceFileName) {
      setError('Selecione o arquivo do edital.');
      setAvailabilityProblems([]);
      return;
    }
    if (sourceMode === 'text' && !sourceText.trim()) {
      setError('Cole o texto do edital.');
      setAvailabilityProblems([]);
      return;
    }

    const problems = validateAvailability(availability);
    if (problems.length > 0) {
      setAvailabilityProblems(problems);
      return;
    }
    setAvailabilityProblems([]);

    const slug = uniqueSlug(title, workspaces.map((workspace) => workspace.slug));

    // O estado inicial é um único cargo em branco, e nada exige que o campo Nome seja
    // preenchido — então "ignorar a seção Cargos" é o caminho mais comum, não uma
    // exceção. Sem isto, `cargos` ficava vazio e `selectedCargoId` apontava para um id
    // inexistente, quebrando o invariante que `migrateWorkspace` garante (ao menos um
    // cargo sempre) — ver regressão I3.
    const namedCargos = cargos.filter((cargo) => cargo.name.trim());
    const finalCargos = namedCargos.length > 0 ? namedCargos : [defaultCargo(examDate)];
    const status = sourceMode === 'none' ? 'sem_edital' : 'aguardando_revisao_edital';

    const newWorkspace: WorkspaceDraft = {
      slug,
      title,
      institution,
      type,
      examDate,
      cargos: finalCargos,
      selectedCargoId: finalCargos[0].id,
      availability,
      status,
      hasEdital: sourceMode !== 'none',
      sourceMode,
      sourceFileName: sourceMode === 'file' ? sourceFileName : undefined,
      sourceText: sourceMode === 'text' ? sourceText : undefined,
      importStatus: 'pending',
      progress: 0,
      nextAction: nextActionFor(status),
      active: true
    };

    if (sourceMode === 'none') {
      addWorkspace(newWorkspace);
      setLocation(`/workspace/${slug}`);
      return;
    }

    stageWorkspaceImport(slug, { isNew: true, workspace: newWorkspace }, user?.id);
    setCreatedSlug(slug);
    setIsProcessing(true);
  };

  const handleReady = () => {
    setLocation(`/workspace/${createdSlug}/edital/revisar/1`);
  };

  return (
    <div className={`k-page-enter min-h-[100dvh] flex flex-col font-sans transition-colors ${theme === 'dark' ? 'bg-[#10131a] text-[#f0f0e8] selection:bg-[#283322]' : 'bg-[#f6f8f7] text-[#16232b] selection:bg-[#e5eed5]'}`}>
      <header className={`flex h-[68px] items-center justify-between px-5 md:px-9 border-b ${theme === 'dark' ? 'border-[#242a34]' : 'border-[#d5dede]'}`}>
        <Link href="/portal" className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#d5f35b] text-[#10131a]">
            <Activity size={16} strokeWidth={2.6} />
          </span>
          <span className="text-[15px] font-bold tracking-[-0.04em]">
            kalibra<span className="text-[#d5f35b]">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <button className="k-button k-button-quiet text-[12px]" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[700px] mx-auto p-5 md:p-9 mt-4 pb-20">
        <Link href="/portal" className="k-button k-button-quiet mb-8 !px-0 -ml-2 text-[12px]">
          <ArrowLeft size={14} /> Voltar ao portal
        </Link>

        <header className="mb-10">
          <p className="k-eyebrow mb-2">novo workspace</p>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.04em] mb-2">
            Configure seu programa
          </h1>
          <p className="text-[13px] text-[#8e98a8]">
            Forneça os detalhes da prova e o edital. A inteligência do Kalibra fará a extração dos tópicos (integração futura).
          </p>
        </header>

        {(error || availabilityProblems.length > 0) && (
          <div className="mb-6 p-4 border border-[#db8f83] bg-[#fff0ee] dark:bg-[#30201f] dark:border-[#ff907d] rounded-[4px] flex gap-3 text-[#c94f45] dark:text-[#ff907d]">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="space-y-2">
              {error && <p className="text-[12px] font-medium">{error}</p>}
              {availabilityProblems.map((problem) => (
                <p key={problem} className="text-[12px] font-medium">{problem}</p>
              ))}
            </div>
          </div>
        )}

        {isProcessing ? (
          <div className={`rounded-[4px] border ${theme === 'dark' ? 'bg-[#131821] border-[#29313d]' : 'bg-white border-[#d5dede]'}`}>
            <EditalUploadProgress onReady={handleReady} onCancel={() => setIsProcessing(false)} />
          </div>
        ) : (
          // `noValidate`: os campos de disponibilidade têm `step` (ligado à sessão máxima —
          // ver AvailabilityFields/M2) e, sem isto, o navegador bloqueia o evento de submit
          // por completo quando um valor digitado não é múltiplo exato do step, sem mostrar
          // nenhuma mensagem — a própria validação customizada (`validateAvailability`,
          // renderizada em `availabilityProblems`) é quem deve decidir o que é um erro.
          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            <section className={`p-6 md:p-8 rounded-[4px] border ${theme === 'dark' ? 'bg-[#131821] border-[#29313d]' : 'bg-white border-[#d5dede]'}`}>
              <h2 className="text-[15px] font-semibold mb-6 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5eed5] dark:bg-[#202b20] text-[#5f7900] dark:text-[#d5f35b] text-[10px] font-bold">1</span>
              Informações Gerais
            </h2>
            
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8]">Título do Programa</label>
                <input 
                  type="text" 
                  className="k-input" 
                  placeholder="Ex: Auditor Fiscal" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8]">Instituição / Banca</label>
                <input 
                  type="text" 
                  className="k-input" 
                  placeholder="Ex: FGV" 
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8]">Data da Prova</label>
                <input 
                  type="date" 
                  className="k-input" 
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8]">Tipo</label>
                <select 
                  className="k-input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="Concurso Público">Concurso Público</option>
                  <option value="Vestibular">Vestibular</option>
                  <option value="Exame de Ordem (OAB)">Exame de Ordem (OAB)</option>
                  <option value="Certificação">Certificação</option>
                </select>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8]">
                Cargos
              </label>
              <CargoFields cargos={cargos} onChange={setCargos} />
            </div>
          </section>

          <section className={`p-6 md:p-8 rounded-[4px] border ${theme === 'dark' ? 'bg-[#131821] border-[#29313d]' : 'bg-white border-[#d5dede]'}`}>
            <h2 className="text-[15px] font-semibold mb-6 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5eed5] dark:bg-[#202b20] text-[#5f7900] dark:text-[#d5f35b] text-[10px] font-bold">2</span>
              Conteúdo do Edital
            </h2>

            <div className="mb-6 flex gap-1 p-1 rounded-[4px] bg-[#f1f4f2] dark:bg-[#0b0e13] border border-[#dfe6e4] dark:border-[#242a34]">
              <button
                type="button"
                onClick={() => setSourceMode('file')}
                className={`flex-1 flex justify-center py-2 text-[12px] font-medium rounded-[3px] transition-colors ${sourceMode === 'file' ? 'bg-white dark:bg-[#202b20] text-[#16232b] dark:text-[#d5f35b] shadow-sm border border-[#d5dede] dark:border-[#35404e]' : 'text-[#6f7b85] dark:text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8]'}`}
              >
                Anexar Arquivo
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('text')}
                className={`flex-1 flex justify-center py-2 text-[12px] font-medium rounded-[3px] transition-colors ${sourceMode === 'text' ? 'bg-white dark:bg-[#202b20] text-[#16232b] dark:text-[#d5f35b] shadow-sm border border-[#d5dede] dark:border-[#35404e]' : 'text-[#6f7b85] dark:text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8]'}`}
              >
                Colar Texto
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('none')}
                className={`flex-1 flex justify-center py-2 text-[12px] font-medium rounded-[3px] transition-colors ${sourceMode === 'none' ? 'bg-white dark:bg-[#202b20] text-[#16232b] dark:text-[#d5f35b] shadow-sm border border-[#d5dede] dark:border-[#35404e]' : 'text-[#6f7b85] dark:text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8]'}`}
              >
                Ainda não tenho
              </button>
            </div>

            {sourceMode === 'none' ? (
              <div className="k-card-soft p-4 flex items-start gap-3">
                <FileText size={16} className="k-muted shrink-0 mt-0.5" />
                <p className="text-[12px] leading-5 k-muted">
                  O workspace será criado com status "sem edital". Você pode importar o edital depois, a qualquer momento, pela tela Edital.
                </p>
              </div>
            ) : sourceMode === 'file' ? (
              <div className="relative">
                <input 
                  type="file" 
                  id="edital-file" 
                  accept=".pdf,.docx,.txt"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                />
                <div className={`flex flex-col items-center justify-center py-10 px-4 rounded-[4px] border-2 border-dashed text-center transition-colors pointer-events-none ${sourceFileName ? 'border-[#6aa17b] bg-[#edf8ef] dark:border-[#80d8a5] dark:bg-[#172c26]' : 'border-[#d5dede] dark:border-[#35404e] bg-[#f6f8f7] dark:bg-[#10131a]'}`}>
                  {sourceFileName ? (
                    <>
                      <CheckCircle2 size={32} className="text-[#23824d] dark:text-[#80d8a5] mb-3" />
                      <p className="text-[14px] font-medium text-[#16232b] dark:text-[#f0f0e8]">{sourceFileName}</p>
                      <p className="text-[11px] text-[#6f7b85] dark:text-[#8e98a8] mt-1">Clique ou arraste para alterar</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={32} className="text-[#8e98a8] mb-3" />
                      <p className="text-[14px] font-medium mb-1">Selecione ou arraste o arquivo do edital</p>
                      <p className="text-[11px] text-[#6f7b85] dark:text-[#8e98a8]">Aceita PDF, DOCX ou TXT (Max 20MB)</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[#6f7b85] dark:text-[#8e98a8] flex justify-between">
                  <span>Conteúdo Programático</span>
                  <span className="normal-case tracking-normal">Apenas a seção de matérias</span>
                </label>
                <textarea 
                  className="k-input min-h-[200px] resize-y font-mono text-[11px] leading-relaxed" 
                  placeholder="Cole aqui o conteúdo programático do edital..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </div>
            )}
          </section>

          <section className={`p-6 md:p-8 rounded-[4px] border ${theme === 'dark' ? 'bg-[#131821] border-[#29313d]' : 'bg-white border-[#d5dede]'}`}>
            <h2 className="text-[15px] font-semibold mb-6 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5eed5] dark:bg-[#202b20] text-[#5f7900] dark:text-[#d5f35b] text-[10px] font-bold">3</span>
              Disponibilidade semanal
            </h2>
            <AvailabilityFields value={availability} onChange={setAvailability} />
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#d5dede] dark:border-[#242a34]">
            <Link href="/portal" className="k-button k-button-quiet">
              Cancelar
            </Link>
            <button type="submit" className="k-button k-button-primary px-8">
              Criar Workspace
            </button>
          </div>
        </form>
        )}
      </main>
    </div>
  );
}