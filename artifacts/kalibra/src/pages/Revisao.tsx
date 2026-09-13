import { useState } from 'react';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { initialNotes } from '@/data';
import type { ReviewCard, Difficulty } from '@/types';

export function Revisao({ cards, onGrade }: { cards: ReviewCard[]; onGrade: (id: string, difficulty: Difficulty) => void }) {
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
