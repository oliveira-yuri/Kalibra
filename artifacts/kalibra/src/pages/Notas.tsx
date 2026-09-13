import { useEffect, useState } from 'react';
import { Check, NotebookPen } from 'lucide-react';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import type { Note } from '@/types';

export function Notas({ notes, onCreateNote, onSaveNote }: { notes: Note[]; onCreateNote: () => string; onSaveNote: (id: string, title: string, content: string) => void }) {
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
