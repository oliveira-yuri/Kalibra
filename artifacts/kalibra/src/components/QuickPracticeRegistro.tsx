import { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Topic } from '@/types';

export function QuickPracticeRegistro({ 
  topics, 
  defaultTopicId, 
  onClose,
  onRegister
}: { 
  topics: Topic[]; 
  defaultTopicId?: string; 
  onClose: () => void;
  onRegister: (topicId: string, total: number, correct: number) => void;
}) {
  const [topicId, setTopicId] = useState(defaultTopicId || (topics[0]?.id || ''));
  const [total, setTotal] = useState('');
  const [correct, setCorrect] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('keydown', handleEscape); document.removeEventListener('mousedown', handleClickOutside); };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicId || !total || !correct) return;
    onRegister(topicId, parseInt(total), parseInt(correct));
    onClose();
  };

  return (
    <div className="absolute top-10 right-0 z-50 w-64 rounded-sm border border-border bg-card p-4 shadow-lg animate-in fade-in zoom-in-95" ref={containerRef}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Registrar prática externa</h3>
        <button onClick={onClose} className="k-icon-button k-button-quiet h-5 w-5 text-muted-foreground"><X size={14} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {!defaultTopicId && (
          <div className="flex items-center gap-2">
            <label className="w-12 text-[11px] text-muted-foreground">Tópico</label>
            <select className="k-input flex-1 !py-1 text-[11px]" value={topicId} onChange={e => setTopicId(e.target.value)}>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2">
            <label className="w-12 text-[11px] text-muted-foreground">Fiz</label>
            <input type="number" min="1" className="k-input !py-1 text-[11px]" value={total} onChange={e => setTotal(e.target.value)} />
          </div>
          <div className="flex flex-1 items-center gap-2">
            <label className="text-[11px] text-muted-foreground">Acertei</label>
            <input type="number" min="0" max={total || 999} className="k-input !py-1 text-[11px]" value={correct} onChange={e => setCorrect(e.target.value)} />
          </div>
        </div>
        <div className="mt-2 text-right">
          <button type="submit" className="k-button k-button-primary !h-7 text-[11px]" disabled={!total || !correct || parseInt(correct) > parseInt(total)}>
            Registrar
          </button>
        </div>
      </form>
    </div>
  );
}
