import { useState } from 'react';
import { ArrowRight, Check, CircleDot, Plus } from 'lucide-react';

export function Flashcards() {
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
