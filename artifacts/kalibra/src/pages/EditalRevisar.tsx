import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { AlertCircle, Plus, MoreHorizontal } from 'lucide-react';
import { useUser } from '@clerk/react';
import { clearPendingWorkspaceImport, getPendingWorkspaceImport, useWorkspaces } from '@/domain/useWorkspaces';

export function EditalRevisar({ workspaceSlug }: { workspaceSlug: string }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const params = useParams();
  const version = params.version || '1';
  const { workspaces, addWorkspace, updateWorkspace } = useWorkspaces(user?.id);
  const [pending] = useState(() => getPendingWorkspaceImport(workspaceSlug, user?.id));
  const workspace = pending?.workspace || workspaces.find(w => w.slug === workspaceSlug);
  const [sections, setSections] = useState([
    { id: 'portugues', name: 'Língua Portuguesa', questions: 10, topics: ['Interpretação de texto', 'Ortografia oficial', 'Crase'] },
    { id: 'matematica', name: 'Matemática', questions: 10, topics: ['Razão e proporção', 'Porcentagem e juros'] },
    { id: 'especificas', name: 'Conhecimentos Específicos', questions: 20, topics: ['Administração pública', 'Lei nº 14.133/2021'] },
  ]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, string>>({});
  
  const handleConfirm = () => {
    if (pending?.isNew && pending.workspace) {
      addWorkspace({
        ...pending.workspace,
        importStatus: 'completed',
        status: 'diagnostico_pendente',
        nextAction: 'Pronto para estudar',
      });
    } else {
      updateWorkspace(workspaceSlug, {
        ...(pending?.updates || {}),
        importStatus: 'completed',
        status: 'diagnostico_pendente',
        nextAction: 'Pronto para estudar'
      });
    }
    clearPendingWorkspaceImport(workspaceSlug, user?.id);
    setLocation('/edital');
  };

  const handleDiscard = () => {
    clearPendingWorkspaceImport(workspaceSlug, user?.id);
    if (pending?.isNew) setLocation(`~${import.meta.env.BASE_URL}portal`);
    else setLocation('/edital');
  };

  const addTopic = (sectionId: string) => {
    const name = window.prompt('Nome do novo tópico');
    if (!name?.trim()) return;
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, topics: [...section.topics, name.trim()] } : section));
  };

  const renameTopic = (sectionId: string, topicIndex: number) => {
    const currentName = sections.find((section) => section.id === sectionId)?.topics[topicIndex] || '';
    const name = window.prompt('Renomear tópico', currentName);
    if (!name?.trim()) return;
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, topics: section.topics.map((topic, index) => index === topicIndex ? name.trim() : topic) } : section));
    setOpenMenu(null);
  };

  const deleteTopic = (sectionId: string, topicIndex: number) => {
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, topics: section.topics.filter((_, index) => index !== topicIndex) } : section));
    setOpenMenu(null);
  };

  const moveTopic = (sectionId: string, topicIndex: number) => {
    const sourceIndex = sections.findIndex((section) => section.id === sectionId);
    const targetIndex = (sourceIndex + 1) % sections.length;
    const topic = sections[sourceIndex].topics[topicIndex];
    setSections((current) => current.map((section, index) => {
      if (index === sourceIndex) return { ...section, topics: section.topics.filter((_, itemIndex) => itemIndex !== topicIndex) };
      if (index === targetIndex) return { ...section, topics: [...section.topics, topic] };
      return section;
    }));
    setOpenMenu(null);
  };

  const fillMissing = (field: string) => {
    const value = window.prompt(`Preencher ${field}`);
    if (value?.trim()) setMissing((current) => ({ ...current, [field]: value.trim() }));
  };

  return (
    <div className="max-w-[800px] mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <p className="k-eyebrow">ESTRUTURA EXTRAÍDA DO EDITAL</p>
          <span className="k-chip">versão {version} · 123 tópicos encontrados</span>
        </div>
        <h1 className="text-[24px] font-semibold">Revise antes de confirmar.</h1>
        <p className="text-[13px] text-[#8e98a8]">Você pode renomear, mover, excluir e adicionar tópicos manualmente.</p>
      </header>

      {version !== '1' && (
        <section className="p-5 bg-white dark:bg-[#131821] border border-[#d5dede] dark:border-[#29313d] rounded-sm space-y-4">
          <h3 className="k-eyebrow">COMPARADO COM A VERSÃO 1</h3>
          
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#6b8d00] dark:text-[#8ed9ae]">
              <span className="k-mono font-bold">+ 4 adicionados</span>
            </div>
            <ul className="pl-6 space-y-1 text-[12px] text-[#52616c] dark:text-[#aeb8c5]">
              <li>Português · Semântica e figuras de linguagem</li>
              <li>Específicas · Lei nº 14.133/2021 — nova redação</li>
              <li>...</li>
            </ul>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#c94f45] dark:text-[#ff907d]">
              <span className="k-mono font-bold">− 2 removidos</span>
            </div>
            <ul className="pl-6 space-y-1 text-[12px] text-[#52616c] dark:text-[#aeb8c5]">
              <li>
                Específicas · Noções de logística
                <div className="flex items-center gap-1 mt-1 text-[#c94f45] dark:text-[#ff907d] font-medium text-[10px]">
                  <AlertCircle size={12} /> este tópico tem 34 questões respondidas e 3 erros registrados
                </div>
              </li>
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-[#6f7b85] dark:text-[#8e98a8]">
              <span className="k-mono font-bold">~ 1 renomeado</span>
            </div>
            <ul className="pl-6 space-y-1 text-[12px] text-[#52616c] dark:text-[#aeb8c5]">
              <li>"Crase" → "Emprego do acento indicativo de crase"</li>
            </ul>
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-[#131821] border border-[#d5dede] dark:border-[#29313d] rounded-sm p-1">
        <div className="space-y-1">
          {sections.map((section, sectionIndex) => <div className="p-3" key={section.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[14px]"><span className="text-[#8e98a8]">▾</span>{section.name}</div>
              <span className="text-[10px] text-[#8e98a8]">{section.questions} questões</span>
            </div>
            <div className="pl-6 mt-2 space-y-1 border-l-2 border-[#f1f4f2] dark:border-[#1a2029] ml-2">
              {section.topics.map((topic, topicIndex) => {
                const menuId = `${section.id}-${topicIndex}`;
                return <div className="relative flex items-center justify-between group hover:bg-[#f1f4f2] dark:hover:bg-[#1a2029] p-1.5 px-3 rounded-sm transition-colors" key={menuId}>
                  <span className="text-[13px]">{topic}</span>
                  <button className="opacity-40 group-hover:opacity-100 k-icon-button !w-6 !h-6" onClick={() => setOpenMenu(openMenu === menuId ? null : menuId)} aria-label={`Ações para ${topic}`}><MoreHorizontal size={14} /></button>
                  {openMenu === menuId && <div className="absolute right-2 top-8 z-10 flex w-36 flex-col border border-[#d5dede] bg-white p-1 shadow-lg dark:border-[#394452] dark:bg-[#161b23]">
                    <button className="k-button k-button-quiet justify-start text-[10px]" onClick={() => renameTopic(section.id, topicIndex)}>Renomear</button>
                    <button className="k-button k-button-quiet justify-start text-[10px]" onClick={() => moveTopic(section.id, topicIndex)}>Mover para {sections[(sectionIndex + 1) % sections.length].name}</button>
                    <button className="k-button k-button-quiet justify-start text-[10px] text-[#c94f45] dark:text-[#ff907d]" onClick={() => deleteTopic(section.id, topicIndex)}>Excluir</button>
                  </div>}
                </div>;
              })}
              <button className="flex items-center gap-2 p-1.5 px-3 text-[12px] text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8] font-medium" onClick={() => addTopic(section.id)}>
                <Plus size={14} /> adicionar tópico
              </button>
            </div>
          </div>)}
        </div>
      </section>
      
      <section className="p-5 bg-[#fff0ee] dark:bg-[#30201f] border border-[#db8f83] dark:border-[#ff907d] rounded-sm">
        <div className="flex items-center gap-2 font-semibold text-[#c94f45] dark:text-[#ff907d] mb-3">
          <AlertCircle size={16} />
          Não encontrado no edital
        </div>
        <ul className="pl-6 list-disc space-y-1 text-[13px] text-[#c94f45] dark:text-[#ff907d]">
          {['peso das matérias', 'data da prova'].map((field) => <li key={field}>{field}{missing[field] ? <span className="ml-2 font-medium text-[#16232b] dark:text-[#f0f0e8]">— {missing[field]}</span> : <button className="ml-2 text-[11px] underline" onClick={() => fillMissing(field)}>preencher</button>}</li>)}
        </ul>
      </section>

      <div className="flex justify-end gap-3 pt-6">
        <button className="k-button k-button-quiet text-[#c94f45] dark:text-[#ff907d]" onClick={handleDiscard}>
          Descartar
        </button>
        <button className="k-button k-button-primary px-8" onClick={handleConfirm}>
          Confirmar estrutura
        </button>
      </div>
    </div>
  );
}
