import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Clock3, FileText, CheckCircle2, ArrowRight, Timer, AlertCircle } from 'lucide-react';

type DiagnosticState = 'start' | 'during' | 'report';

export function Diagnostico({ workspaceSlug }: { workspaceSlug: string }) {
  const [state, setState] = useState<DiagnosticState>('start');
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'Baixa' | 'Média' | 'Alta' | null>(null);
  const [flagged, setFlagged] = useState<number[]>([]);
  
  const handleStart = () => setState('during');
  
  const handleAnswer = (conf: 'Baixa' | 'Média' | 'Alta') => {
    setConfidence(conf);
  };

  const goToQuestion = (nextIndex: number) => {
    setIndex(nextIndex);
    setSelectedOption(null);
    setConfidence(null);
  };

  const goNext = () => {
    if (index === 39) setState('report');
    else goToQuestion(index + 1);
  };
  
  if (state === 'start') {
    return (
      <div className="max-w-[600px] mx-auto text-center py-20 animate-in fade-in">
        <p className="k-eyebrow mb-3">PROVA DIAGNÓSTICA · CICLO 04</p>
        <h1 className="text-[28px] font-semibold mb-6">Analista Técnico (Informática)</h1>
        
        <div className="flex items-center justify-center gap-6 mb-8 text-[13px] text-[#6f7b85] dark:text-[#8e98a8]">
          <span className="flex items-center gap-2"><FileText size={16} /> 40 questões</span>
          <span className="flex items-center gap-2"><Clock3 size={16} /> 3h30</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={16} /> formato real da prova</span>
        </div>
        
        <p className="mb-10 text-[14px]">10 Português · 10 Matemática · 20 Específicas</p>
        
        <div className="bg-[#f1f4f2] dark:bg-[#131821] border border-[#dfe6e4] dark:border-[#29313d] p-4 rounded-sm inline-block mb-10">
          <p className="text-[12px]">Todas as questões são inéditas para você.</p>
        </div>
        
        <div>
          <button className="k-button k-button-primary px-8 py-2 text-[14px]" onClick={handleStart}>
            Começar agora
          </button>
        </div>
      </div>
    );
  }
  
  if (state === 'during') {
    // Focus mode: simulate no sidebar (would need App.tsx wrapper logic normally, but here we just render clean content)
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-[#f6f8f7] px-5 text-[#16232b] dark:bg-[#10131a] dark:text-[#f0f0e8] animate-in fade-in">
       <div className="max-w-[800px] mx-auto pt-6 pb-20">
        <header className="flex items-center justify-between border-b border-[#dfe6e4] dark:border-[#29313d] pb-4 mb-8">
          <div className="flex items-center gap-3 text-[14px] font-medium text-[#c94f45] dark:text-[#ff907d]">
            <Timer size={16} /> 03:29:58
          </div>
          <div className="flex items-center gap-2">
            <button className="k-button k-button-quiet text-[10px]" onClick={() => setState('report')}>Encerrar e ver relatório</button>
            <span className="k-chip">{index + 1} / 40</span>
          </div>
        </header>
        
        <section className="space-y-6">
          <p className="text-[12px] text-[#8e98a8]">Língua Portuguesa</p>
          <h2 className="text-[18px] leading-relaxed font-medium">Assinale a alternativa que apresenta erro de concordância verbal.</h2>
          
          <div className="space-y-3 mt-8">
            {['Fazem cinco anos que não o vejo.', 'Havia muitas pessoas na sala.', 'Devem existir outras opções.', 'Vão fazer dois meses de atraso.'].map((opt, i) => (
              <button key={i} onClick={() => { setSelectedOption(i); setConfidence(null); }} className={`k-option flex w-full items-start gap-3 p-4 text-left text-[13px] hover:bg-[#f1f4f2] dark:hover:bg-[#1a2029] ${selectedOption === i ? 'border-[#6b8d00] bg-[#eef5d8] dark:border-[#d5f35b] dark:bg-[#202b20]' : ''}`}>
                <span className="k-mono flex h-5 w-5 shrink-0 items-center justify-center border border-[#d5dede] dark:border-[#455161] text-[10px] text-[#6f7b85] dark:text-[#aeb8c5]">{String.fromCharCode(65 + i)}</span>
                <span className="pt-0.5">{opt}</span>
              </button>
            ))}
          </div>
          
          {selectedOption !== null && <div className="mt-8 border border-[#d5dede] dark:border-[#394452] bg-[#fcfcfc] dark:bg-[#131821] p-5 text-center animate-in fade-in zoom-in-95">
            <p className="text-[12px] font-medium mb-4">Qual sua confiança nesta resposta?</p>
            <div className="flex justify-center gap-3">
              <button className={`k-chip cursor-pointer w-24 text-center ${confidence === 'Baixa' ? 'bg-[#e9efed] dark:bg-[#202b20]' : 'hover:bg-[#e9efed] dark:hover:bg-[#202b20]'}`} onClick={() => handleAnswer('Baixa')}>Baixa</button>
              <button className={`k-chip cursor-pointer w-24 text-center ${confidence === 'Média' ? 'bg-[#e9efed] dark:bg-[#202b20]' : 'hover:bg-[#e9efed] dark:hover:bg-[#202b20]'}`} onClick={() => handleAnswer('Média')}>Média</button>
              <button className={`k-chip cursor-pointer w-24 text-center ${confidence === 'Alta' ? 'bg-[#e9efed] dark:bg-[#202b20]' : 'hover:bg-[#e9efed] dark:hover:bg-[#202b20]'}`} onClick={() => handleAnswer('Alta')}>Alta</button>
            </div>
          </div>}

          {confidence && <div className="flex flex-col gap-3 border-t border-[#dfe6e4] pt-5 dark:border-[#29313d] sm:flex-row sm:items-center">
            <button className={`k-button ${flagged.includes(index) ? 'border-[#ff907d] text-[#c94f45] dark:text-[#ff907d]' : 'k-button-quiet'}`} onClick={() => setFlagged((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}>
              {flagged.includes(index) ? 'Marcada para revisar' : 'Marcar para revisar'}
            </button>
            <div className="ml-auto flex gap-2">
              <button className="k-button k-button-quiet" disabled={index === 0} onClick={() => goToQuestion(index - 1)}>Anterior</button>
              <button className="k-button k-button-primary" onClick={goNext}>{index === 39 ? 'Finalizar prova' : 'Próxima questão'} <ArrowRight size={14} /></button>
            </div>
          </div>}
        </section>
       </div>
      </div>
    );
  }

  // state === 'report'
  return (
    <div className="max-w-[800px] mx-auto space-y-8 animate-in fade-in">
      <header className="border-b border-[#d5dede] dark:border-[#29313d] pb-6">
        <p className="k-eyebrow mb-2">Relatório do diagnóstico</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <span className="k-mono text-[42px] tracking-[-0.05em] leading-none text-[#6b8d00] dark:text-[#d5f35b]">27 <span className="text-[24px] text-[#6f7b85] dark:text-[#8e98a8]">/ 40</span></span>
            <span className="k-mono text-[20px] mb-1 text-[#6b8d00] dark:text-[#d5f35b]">67,5%</span>
          </div>
          <span className="text-[12px] text-[#8e98a8]">linha de corte sugerida: 20 acertos</span>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h3 className="text-[14px] font-semibold mb-4">Por seção</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[12px]">
              <span>Português</span>
              <div className="flex items-center gap-4 text-[#8e98a8]">
                <span className="k-mono w-8 text-right">8/10</span>
                <span className="k-mono w-8 text-right font-medium text-[#16232b] dark:text-[#f0f0e8]">80%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span>Matemática</span>
              <div className="flex items-center gap-4 text-[#8e98a8]">
                <span className="k-mono w-8 text-right">6/10</span>
                <span className="k-mono w-8 text-right font-medium text-[#16232b] dark:text-[#f0f0e8]">60%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span>Específicas</span>
              <div className="flex items-center gap-4 text-[#8e98a8]">
                <span className="k-mono w-8 text-right">13/20</span>
                <span className="k-mono w-8 text-right font-medium text-[#16232b] dark:text-[#f0f0e8]">65%</span>
              </div>
            </div>
          </div>
          
          <h3 className="text-[14px] font-semibold mt-10 mb-4">Comparado ao diagnóstico anterior</h3>
          <div className="flex gap-4 text-[12px]">
            <span className="flex gap-2">Português <span className="k-mono text-[#6b8d00] dark:text-[#8ed9ae] font-medium">+2</span></span>
            <span className="flex gap-2">Matemática <span className="k-mono text-[#c94f45] dark:text-[#ff907d] font-medium">−1</span></span>
            <span className="flex gap-2">Específicas <span className="k-mono text-[#6b8d00] dark:text-[#8ed9ae] font-medium">+4</span></span>
          </div>
        </section>

        <section>
          <h3 className="text-[14px] font-semibold mb-4">Acerto × confiança</h3>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[#8e98a8] border-b border-[#d5dede] dark:border-[#29313d]">
                <th className="font-normal py-2"></th>
                <th className="font-normal py-2 k-mono text-center">acertou</th>
                <th className="font-normal py-2 k-mono text-center">errou</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#d5dede] dark:border-[#29313d]">
                <td className="py-3">confiança alta</td>
                <td className="py-3 text-center k-mono">18</td>
                <td className="py-3 text-center k-mono relative bg-[#fff0ee] dark:bg-[#30201f] text-[#c94f45] dark:text-[#ff907d] font-bold">
                  4
                  <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 translate-x-full hidden md:flex items-center gap-1 w-max text-[9px] font-sans">
                    <ArrowRight size={10} /> 4 erros com convicção
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-3">confiança baixa</td>
                <td className="py-3 text-center k-mono">9</td>
                <td className="py-3 text-center k-mono">9</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-[11px] text-[#8e98a8] leading-relaxed">
            O quadrante "errou com confiança alta" concentra crenças incorretas. Trate esses 4 tópicos como <strong className="text-[#c94f45] dark:text-[#ff907d] font-semibold">prioridade máxima</strong> de revisão antes do próximo ciclo.
          </p>
        </section>
      </div>

      <div className="pt-10 flex justify-center">
        <Link href="/" className="k-button k-button-primary">Voltar ao portal do ciclo</Link>
      </div>
    </div>
  );
}
