import { useState } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCircle2, CircleAlert, Flag, RotateCcw, Timer } from 'lucide-react';
import { questions } from '@/data';
import type { Question } from '@/types';

export function Questoes({ onRegisterError }: { onRegisterError: (question: Question) => void }) {
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
