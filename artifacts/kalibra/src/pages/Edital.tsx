import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  CheckCircle2, FileText, Filter, Info, MoreHorizontal, UploadCloud, X,
} from 'lucide-react';
import { EditalUploadProgress } from '@/components/EditalUploadProgress';
import { QuickPracticeRegistro } from '@/components/QuickPracticeRegistro';
import { CargoFilter } from '@/components/CargoFilter';
import { EditalSourceBlocks } from '@/components/EditalSourceBlocks';
import { stageWorkspaceImport, useWorkspaces, nextSyllabusVersionFor } from '@/domain/useWorkspaces';
import { useExtraction } from '@/domain/useExtraction';
import { useSyllabus } from '@/domain/useSyllabus';
import {
  nextActionFor, assertTransition, canTransition, cargosFor, isCommon, totalQuestionsFor, WORKSPACE_STATUS_LABELS,
  type ExtractionErrorKind, type ExtractionStage, type WorkspaceStatus, type Syllabus, type SyllabusItem, type CargoTextBlock,
} from '@workspace/core';
import type { Topic } from '@/types';
import { useToast } from '@/hooks/use-toast';

/** "Matéria" de um tópico (item folha): o rótulo do pai quando existe, senão o
 * próprio rótulo (item de topo sem filhos, ex.: matéria recém-criada e ainda vazia). */
function subjectLabelFor(syllabus: Syllabus, item: SyllabusItem): string {
  if (!item.parentItemId) return item.sourceLabel;
  const parent = syllabus.items.find((candidate) => candidate.id === item.parentItemId);
  return parent ? parent.sourceLabel : item.sourceLabel;
}

/** Tópicos de verdade para a tabela: itens-folha do programa — quem tem filho vira só
 * o agrupador ("matéria") de quem não tem, nunca uma linha própria. */
function leafItemsOf(syllabus: Syllabus): SyllabusItem[] {
  const parentIds = new Set(
    syllabus.items.map((item) => item.parentItemId).filter((id): id is string => id !== null),
  );
  return syllabus.items.filter((item) => !parentIds.has(item.id));
}

/** Estados de processo (enviando/extraindo/identificando) colapsam num único status de workspace — só "pronto" e "erro" têm status próprio. */
const STATUS_FOR_STAGE: Record<ExtractionStage, WorkspaceStatus> = {
  enviando: 'extraindo_edital',
  extraindo: 'extraindo_edital',
  identificando: 'extraindo_edital',
  pronto: 'aguardando_revisao_edital',
  erro: 'erro',
};

export function Edital({ workspaceSlug }: { workspaceSlug: string }) {
  const { user } = useUser();
  const { workspaces, updateWorkspace } = useWorkspaces(user?.id);
  const workspace = workspaces.find((w) => w.slug === workspaceSlug);
  const extraction = useExtraction(workspaceSlug);
  const syllabusApi = useSyllabus(workspaceSlug, user?.id);
  const workspaceStatusRef = useRef<WorkspaceStatus>(workspace?.status ?? 'sem_edital');
  // Achado C1 da revisão final: a rota de revisão da reimportação era um literal fixo
  // (`/edital/revisar/2`) — toda reimportação, não importa quantas já tinham
  // acontecido antes (inclusive abandonadas no meio do caminho), roteava para a MESMA
  // URL, e o inicializador de `EditalRevisar` podia retomar a proposta de uma
  // reimportação abandonada em vez da que o usuário acabou de rodar. O número sai de
  // `nextSyllabusVersionFor`, lido da realidade durável (fila + programa salvo).
  // Achado R2 da re-revisão: o padrão era o literal `2` — um `handleReady` alcançado
  // sem passar por `saveEditalUpdate` navegava para um número que ninguém apurou.
  // `null` não tem esse buraco: quem lê é obrigado a apurar o número na hora.
  const reviewVersionRef = useRef<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('Todas');
  const [priorityFilter, setPriorityFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [cargoFilter, setCargoFilter] = useState<string | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<'file' | 'text'>('file');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceBlocks, setSourceBlocks] = useState<CargoTextBlock[]>([]);
  const [updateError, setUpdateError] = useState('');
  const [updateSaved, setUpdateSaved] = useState(false);

  /**
   * Hidrata o editor com os blocos já salvos, no momento em que o modal ABRE.
   *
   * Antes disto `sourceBlocks` era write-only: os blocos eram gravados no registro do
   * workspace, mas o estado da tela nascia `[]`, então reabrir o modal mostrava campos
   * vazios e a edição por cargo valia uma sessão só.
   *
   * Por que na abertura e não num efeito: um efeito que observasse `workspace`
   * re-sincronizaria enquanto o usuário digita — qualquer gravação no registro
   * (inclusive as que a própria tela faz) apagaria o que ele acabou de escrever.
   * Abrir o modal é o único momento em que hidratar não pode atropelar ninguém.
   *
   * Por que só quando a última importação foi por TEXTO: os blocos salvos descrevem a
   * última importação apenas nesse caso. Se depois dela o usuário reimportou por
   * arquivo, aquele texto já foi superado — trazê-lo de volta sugeriria que o edital
   * vigente veio dali, e salvá-lo sem perceber reintroduziria conteúdo obsoleto.
   *
   * Registro anterior à Fase 1B.5 não precisa de tratamento aqui: `blocksFrom`
   * (`workspaces.ts`) já converte o `sourceText` legado num bloco comum na leitura.
   */
  const openUpdateModal = () => {
    const salvos = workspace?.sourceMode === 'text' ? workspace.sourceBlocks : [];
    if (salvos.some((block) => block.text.trim() !== '')) {
      setSourceBlocks(salvos);
      // Sem trocar a aba, o conteúdo ficaria carregado atrás de "Arquivo" — hidratar
      // sem mostrar não é "os blocos aparecem como estavam salvos".
      setSourceMode('text');
    }
    setIsUpdateModalOpen(true);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [practiceTopic, setPracticeTopic] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Autocura de um workspace preso em "extraindo_edital" de uma sessão anterior que
  // nunca terminou (aba fechada, navegador reiniciado — nenhum cleanup de desmontagem
  // roda nesses casos). Sem isto, um usuário que reabre o app encontra o mesmo status
  // sem nenhuma aresta de saída (Finding 1, fix round 1). `!isProcessing` é o que
  // distingue essa herança de uma extração de verdade em andamento NESTA sessão (que
  // já teria `isProcessing` true e não pode ser interrompida por engano).
  useEffect(() => {
    if (workspace?.status === 'extraindo_edital' && !isProcessing) {
      workspaceStatusRef.current = 'erro';
      updateWorkspace(workspaceSlug, { status: 'erro', nextAction: nextActionFor('erro') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a uma troca de status externa (herdada ou de outra aba), não a cada render.
  }, [workspace?.status, isProcessing]);

  // Task 15: a lista vem do programa realmente salvo (nunca de `@/data`) — os itens
  // que não são pai de ninguém são os tópicos de verdade da tabela; quem tem filho
  // vira só o agrupador ("matéria") deles.
  const syllabus = syllabusApi.syllabus;
  const leafItems = leafItemsOf(syllabus);

  const handleRegisterPractice = (topicId: string, total: number, correct: number) => {
    const item = leafItems.find((candidate) => candidate.id === topicId);
    const percent = Math.round((correct / total) * 100);
    toast({ description: `${total} questões registradas em ${(item?.sourceLabel ?? '').split(' ')[0]} · ${percent}%` });
    setPracticeTopic(null);
  };

  const saveEditalUpdate = () => {
    if (sourceMode === 'file' && !sourceFileName) {
      setUpdateError('Selecione um arquivo antes de continuar.');
      return;
    }
    if (sourceMode === 'text' && sourceBlocks.every((block) => block.text.trim() === '')) {
      setUpdateError('Cole o conteúdo atualizado do edital antes de continuar.');
      return;
    }

    // Ao contrário de NovoWorkspace (workspace ainda não existe), aqui o workspace já
    // é real e pode estar em QUALQUER status quando o usuário clica em reimportar —
    // inclusive um em que a transição para "aguardando_upload" não é válida (ex.:
    // "diagnóstico em andamento"). Fix round 1 (Finding 1, crítico): a versão anterior
    // chamava `assertTransition` direto sobre a entrada do usuário, sem checar antes —
    // o throw escapava do handler de clique, o modal ficava travado e o usuário não via
    // mensagem nenhuma. `canTransition` decide ANTES de qualquer `assertTransition`
    // rodar; o assert continua depois só como cinto-e-suspensório de design-by-contract,
    // nunca mais alcançável com uma entrada inválida.
    const current = workspace?.status ?? 'sem_edital';
    if (!canTransition(current, 'aguardando_upload')) {
      setUpdateError(
        `Não é possível reimportar agora: o workspace está em "${WORKSPACE_STATUS_LABELS[current]}". Aguarde essa etapa terminar e tente de novo.`,
      );
      return;
    }
    setUpdateError('');

    // O status caminha de verdade por `updateWorkspace`, visível em qualquer outra
    // tela (Portal, WorkspaceStatusChip) enquanto a extração roda (Task 10).
    assertTransition(current, 'aguardando_upload');
    workspaceStatusRef.current = 'aguardando_upload';
    updateWorkspace(workspaceSlug, { status: 'aguardando_upload', nextAction: nextActionFor('aguardando_upload') });

    // Apurado AGORA — no início desta reimportação — para que a URL de revisão já
    // exista mesmo que a extração seja abandonada no meio.
    reviewVersionRef.current = nextSyllabusVersionFor(workspaceSlug, user?.id);
    setIsProcessing(true);
    extraction.start({
      sourceMode,
      blocks: sourceMode === 'text' ? sourceBlocks : [],
      cargoIds: workspace?.cargos.map((cargo) => cargo.id) ?? [],
    });
  };

  // Reflete cada avanço real de `useExtraction` no status do workspace (que já existe
  // de verdade neste fluxo, diferente de NovoWorkspace) — `assertTransition` garante que
  // só andamos por arestas válidas do grafo de `lib/core`.
  useEffect(() => {
    if (!isProcessing) return;
    const nextStatus = STATUS_FOR_STAGE[extraction.progress.stage];
    if (nextStatus === workspaceStatusRef.current) return;
    assertTransition(workspaceStatusRef.current, nextStatus);
    workspaceStatusRef.current = nextStatus;
    updateWorkspace(workspaceSlug, { status: nextStatus, nextAction: nextActionFor(nextStatus) });
  }, [extraction.progress.stage, isProcessing, workspaceSlug]);

  // `extraindo_edital` só tem duas saídas válidas no grafo de `lib/core`:
  // "aguardando_revisao_edital" (extração terminou) e "erro". Se a extração é
  // interrompida ANTES de chegar lá — cancelada, ou a tela fecha/navega no meio do
  // caminho — nada mais no app jamais tira o workspace desse status: não há aresta de
  // volta para "aguardando_upload". Fix round 1 (Finding 1): sempre que uma
  // interrupção acontece com o status ainda em "extraindo_edital", este efeito o leva
  // para "erro" — a única saída válida — de onde uma nova tentativa de reimportar
  // (erro -> aguardando_upload, aresta válida) volta a funcionar.
  useEffect(() => () => {
    if (workspaceStatusRef.current === 'extraindo_edital') {
      updateWorkspace(workspaceSlug, { status: 'erro', nextAction: nextActionFor('erro') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o cleanup de desmontagem importa; lê o ref mais recente, não o que a montagem capturou.
  }, []);

  const handleReady = () => {
    // O status já foi levado a "aguardando_revisao_edital" pelo efeito acima quando
    // `progress.stage` chegou a "pronto" — o que falta transportar até `EditalRevisar`
    // é só o conteúdo bruto da extração (Task 11 roda `dedupeEntries` a partir dele).
    stageWorkspaceImport(workspaceSlug, {
      isNew: false,
      updates: {
        sourceMode,
        sourceFileName: sourceMode === 'file' ? sourceFileName : undefined,
        // Achado C1 da rodada 1 de correção: `sourceBlocks: sourceMode === 'text' ?
        // sourceBlocks : []` escrevia a CHAVE mesmo no ramo "Arquivo" — e como este
        // objeto é mesclado raso em cima do workspace (EditalRevisar.tsx, no
        // `updateWorkspace(slug, { ...pending.updates, ... }`), gravar `[]` aqui
        // apagava para sempre qualquer `sourceBlocks` já salvo (ou tornava um
        // `sourceText` legado inacessível — `blocksFrom` trata "o array existe",
        // mesmo vazio, como já migrado). Espalhar a chave só quando há texto de
        // verdade é o que impede a reimportação por Arquivo de tocar num campo que
        // não é dela.
        ...(sourceMode === 'text' ? { sourceBlocks } : {}),
        importStatus: 'pending',
      },
      extractionOutput: extraction.output ?? undefined,
    }, user?.id);
    setIsUpdateModalOpen(false);
    setIsProcessing(false);
    setSourceFileName('');
    setSourceBlocks([]);
    // `??` e não `!`: se este `handleReady` foi alcançado sem passar por
    // `saveEditalUpdate` (achado R2 da re-revisão), o número é apurado agora em vez de
    // cair num literal que ninguém apurou.
    setLocation(`/edital/revisar/${reviewVersionRef.current ?? nextSyllabusVersionFor(workspaceSlug, user?.id)}`);
  };

  const handleExtractionAction = (kind: ExtractionErrorKind) => {
    setIsProcessing(false);
    if (kind === 'scanned') setSourceMode('text');
    if (kind === 'corrupted') setSourceFileName('');
  };

  // Cancelar no meio de "extraindo_edital" tem a mesma lacuna que o cleanup de
  // desmontagem cobre: sem uma aresta de volta para "aguardando_upload", só "erro" é
  // válido daqui (Finding 1, fix round 1) — feito aqui também para o usuário ver o
  // status mudar na hora, sem precisar sair da tela primeiro.
  const handleCancelExtraction = () => {
    extraction.cancel();
    if (workspaceStatusRef.current === 'extraindo_edital') {
      workspaceStatusRef.current = 'erro';
      updateWorkspace(workspaceSlug, { status: 'erro', nextAction: nextActionFor('erro') });
    }
    setIsProcessing(false);
  };

  // Matéria vem do programa real; prioridade e status ainda não existem por tópico
  // (só chegam com o diagnóstico, Fase 1C) — um filtro que não seja "todas/todos"
  // nesses dois não pode inventar correspondência: a lista fica honestamente vazia
  // em vez de fingir que algum tópico já tem essa informação. "não iniciado" é a
  // única exceção real: nenhum tópico foi estudado ainda nesta fase (não há sessão
  // de estudo no produto até aqui), então todos batem com ele de verdade.
  const subjectOptions = Array.from(new Set(leafItems.map((item) => subjectLabelFor(syllabus, item))))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filtered = leafItems.filter((item) => {
    if (cargoFilter && !cargosFor(syllabus, item.id).includes(cargoFilter)) return false;
    if (subjectFilter !== 'Todas' && subjectLabelFor(syllabus, item) !== subjectFilter) return false;
    if (priorityFilter !== 'todas') return false;
    if (statusFilter !== 'todos' && statusFilter !== 'não iniciado') return false;
    return true;
  });

  const commonCount = leafItems.filter((item) => isCommon(syllabus, item.id)).length;

  // Só para o formulário de registro rápido de prática (`QuickPracticeRegistro`) —
  // ele espera o formato `Topic` de `@/types` (id/name no <select>); os campos que
  // ele não usa (status/priority/accuracy/lastStudied) nunca aparecem em tela, então
  // um valor de preenchimento aqui não é a fabricação que a Task 15 proíbe — essa
  // proibição é sobre o que a TABELA mostra ao aluno.
  const practiceTopics: Topic[] = filtered.map((item) => ({
    id: item.id,
    subject: subjectLabelFor(syllabus, item),
    name: item.sourceLabel,
    status: 'não iniciado',
    priority: 'baixa',
    accuracy: 0,
    lastStudied: 'nunca',
  }));

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
              <EditalUploadProgress
                progress={extraction.progress}
                onReady={handleReady}
                onCancel={handleCancelExtraction}
                onAction={handleExtractionAction}
              />
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
                <EditalSourceBlocks cargos={workspace?.cargos ?? []} blocks={sourceBlocks} onChange={setSourceBlocks} />
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
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="k-eyebrow mb-2">estrutura da prova · {leafItems.length} tópicos mapeados</p>
        <h2 className="text-[26px] font-semibold tracking-[-0.045em]">Edital em estado de estudo</h2>
        <p className="mt-2 text-[12px] text-[#8e98a8]">Use o status como decisão de próxima sessão, não como checklist decorativo.</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="k-button" data-testid="button-import-syllabus" onClick={openUpdateModal}><UploadCloud size={14} /> Atualizar edital</button>
        <button className="k-button" data-testid="button-export-syllabus"><FileText size={14} /> Exportar recorte</button>
      </div>
    </div>

    {workspace && workspace.cargos.length > 0 && (
      <div className="space-y-2">
        <p className="k-eyebrow">tópicos de</p>
        <CargoFilter cargos={workspace.cargos} selected={cargoFilter} onSelect={setCargoFilter} />
      </div>
    )}

    {commonCount > 0 && (
      <div className="k-card-soft p-3 flex items-start gap-3">
        <Info size={14} className="k-muted shrink-0 mt-0.5" />
        <p className="text-[11px] leading-5 k-muted">
          {commonCount} {commonCount === 1 ? 'tópico é comum' : 'tópicos são comuns'} a mais de um cargo e {commonCount === 1 ? 'aparece' : 'aparecem'} uma vez só nesta lista.
        </p>
      </div>
    )}

    <div className="k-card flex flex-col gap-3 p-3 md:flex-row">
      <div className="flex items-center gap-2 text-[11px] text-[#8e98a8]"><Filter size={14} /> filtros ativos</div>
      <select className="k-input md:w-[210px]" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} data-testid="select-subject-filter">
        <option>Todas</option>
        {subjectOptions.map((subject) => <option key={subject}>{subject}</option>)}
      </select>
      <select
        className="k-input md:w-[145px]"
        value={priorityFilter}
        onChange={(event) => setPriorityFilter(event.target.value)}
        data-testid="select-priority-filter"
        disabled
        title="Prioridade chega com o diagnóstico (Fase 1C) — ainda não há dado para filtrar."
      >
        <option value="todas">Prioridade</option>
        <option value="alta">Alta</option>
        <option value="média">Média</option>
        <option value="baixa">Baixa</option>
      </select>
      <select className="k-input md:w-[165px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} data-testid="select-status-filter">
        <option value="todos">Todos os status</option>
        <option value="dominar">Dominar</option>
        <option value="em andamento">Em andamento</option>
        <option value="não iniciado">Não iniciado</option>
      </select>
      <span className="ml-auto hidden items-center gap-2 px-2 text-[10px] text-[#8e98a8] md:flex">
        <span className="h-2 w-2 rounded-full bg-[#d5f35b]" />
        {filtered.length} tópicos{cargoFilter ? ` · ${totalQuestionsFor(syllabus, cargoFilter)} questões` : ''}
      </span>
    </div>

    <div className="k-card overflow-hidden">
      <div className="hidden grid-cols-[1.2fr_1.5fr_.7fr_.7fr_.8fr_70px] gap-4 bg-[#131820] px-5 py-3 text-[10px] uppercase tracking-[.1em] text-[#697587] md:grid">
        <span>matéria</span><span>tópico</span><span>prioridade</span><span>acerto</span><span>status</span><span />
      </div>
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-[#8e98a8]" data-testid="edital-topics-empty">
          {leafItems.length === 0
            ? 'Nenhum tópico no programa ainda — importe e confirme um edital para ver a estrutura aqui.'
            : 'Nenhum tópico corresponde aos filtros selecionados.'}
        </div>
      ) : filtered.map((item) => {
        const itemCargos = cargosFor(syllabus, item.id);
        const common = itemCargos.length > 1;
        return (
          <div key={item.id} className="k-table-row grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1.5fr_.7fr_.7fr_.8fr_70px] md:items-center md:gap-4" data-testid={`row-topic-${item.id}`}>
            <div>
              <span className="text-[11px] text-[#aeb8c5]">{subjectLabelFor(syllabus, item)}</span>
              <span className="mt-1 block text-[10px] text-[#647080]">sem sessão registrada</span>
            </div>
            <div>
              <Link href="/estudo" className="text-[12px] font-medium hover:text-[#d5f35b]" data-testid={`link-topic-${item.id}`}>{item.sourceLabel}</Link>
              {common && <span className="k-chip ml-2" data-testid={`chip-common-${item.id}`}>{itemCargos.length} cargos</span>}
            </div>
            <span className="k-chip w-fit text-[#8e98a8]" title="Prioridade chega com o diagnóstico (Fase 1C).">sem dados</span>
            <span className="k-mono text-[12px] text-[#8e98a8]" title="Acerto chega com o diagnóstico (Fase 1C).">sem dados até o diagnóstico</span>
            <span className="w-fit text-[10px] text-[#8e98a8]">não iniciado</span>
            <div className="flex items-center gap-1 justify-end relative">
              <button className="k-button k-button-quiet k-icon-button" onClick={() => setPracticeTopic(item.id)} aria-label={`Registrar prática para ${item.sourceLabel}`} title="Registrar prática"><CheckCircle2 size={15} className="opacity-50 hover:opacity-100" /></button>
              <button className="k-button k-button-quiet k-icon-button" data-testid={`button-topic-menu-${item.id}`} aria-label={`Ações para ${item.sourceLabel}`}><MoreHorizontal size={15} /></button>
              {practiceTopic === item.id && (
                <QuickPracticeRegistro topics={practiceTopics} defaultTopicId={item.id} onClose={() => setPracticeTopic(null)} onRegister={handleRegisterPractice} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>;
}
