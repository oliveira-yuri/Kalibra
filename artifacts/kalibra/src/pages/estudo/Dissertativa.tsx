import { useState } from 'react';

export function Dissertativa() {
  const [text, setText] = useState('');
  const [evaluated, setEvaluated] = useState(false);
  const lines = text.split('\n').length;
  
  return (
    <div className="space-y-6">
      <div className="mb-4">
        <p className="k-eyebrow mb-2">QUESTÃO TEÓRICO-PRÁTICA</p>
        <p className="text-[14px] leading-relaxed">
          Discorra sobre a aplicação de juros simples no sistema financeiro, abordando seu conceito básico e comparando brevemente seu impacto em relação a juros compostos em períodos curtos.
        </p>
      </div>
      
      {!evaluated ? (
        <div className="animate-in fade-in">
          <p className="text-[12px] text-[#8e98a8] mb-3">Escreva à mão, em papel, respeitando o limite de linhas. Depois transcreva aqui para receber a avaliação.</p>
          <textarea 
            className="k-input min-h-[280px] resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sua resposta dissertativa transcrita..."
          />
          <div className="mt-4 flex items-center justify-between">
            <span className={`text-[12px] ${lines < 10 ? 'text-[#ff907d]' : 'text-[#8e98a8]'}`}>linhas escritas: {text.trim() ? lines : 0} / 30</span>
            <button className="k-button k-button-primary" onClick={() => setEvaluated(true)} disabled={!text.trim()}>Avaliar</button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in border border-[#394452] dark:border-[#35404e] bg-white dark:bg-[#131821] p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[18px] font-semibold">Avaliação</h3>
            <span className="k-mono text-[20px] text-[#6b8d00] dark:text-[#d5f35b] font-bold">7,5 / 10</span>
          </div>
          
          <div className="space-y-5">
            <div className="border-t border-[#d5dede] dark:border-[#29313d] pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[13px]">Tema</span>
                <span className="k-mono text-[13px] text-[#6f7b85] dark:text-[#8e98a8]">4,0 / 5,0</span>
              </div>
              <ul className="text-[12px] text-[#6f7b85] dark:text-[#8e98a8] pl-4 list-disc space-y-1">
                <li>atende parcialmente ao problema</li>
              </ul>
            </div>
            
            <div className="border-t border-[#d5dede] dark:border-[#29313d] pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[13px]">Estrutura do período e parágrafo</span>
                <span className="k-mono text-[13px] text-[#6f7b85] dark:text-[#8e98a8]">2,0 / 2,5</span>
              </div>
              <ul className="text-[12px] text-[#6f7b85] dark:text-[#8e98a8] pl-4 list-disc space-y-1">
                <li>poucas falhas de progressão</li>
              </ul>
            </div>
            
            <div className="border-t border-[#d5dede] dark:border-[#29313d] pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-[13px]">Domínio do estilo formal</span>
                <span className="k-mono text-[13px] text-[#6f7b85] dark:text-[#8e98a8]">1,5 / 2,5</span>
              </div>
              <ul className="text-[12px] text-[#6f7b85] dark:text-[#8e98a8] pl-4 list-disc space-y-1">
                <li>concordância no 2º parágrafo</li>
                <li>crase indevida antes de verbo</li>
                <li>acentuação: "critérios"</li>
              </ul>
            </div>
          </div>
          <button className="k-button k-button-quiet mt-6 w-full text-[12px]" onClick={() => setEvaluated(false)}>Voltar ao texto</button>
        </div>
      )}
    </div>
  );
}
