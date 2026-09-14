import { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  EXTRACTION_ERROR_MESSAGES,
  type ExtractionErrorKind,
  type ExtractionProgress,
} from '@workspace/core';

/** Pausa curta para o usuário ver o quarto passo marcado antes de navegar — mesma cadência do protótipo anterior, só que disparada pelo estado real em vez de um `setTimeout` de simulação. */
const READY_DELAY_MS = 600;

/**
 * Puramente dirigido pelo `progress` do adaptador (`useExtraction`) — a tela dona é
 * quem chama `start()`, decide o `cargoIds` e reage a `onAction`. O componente não
 * simula mais nada: layout e classes são os mesmos de antes (Task 10, PD-07).
 */
export function EditalUploadProgress({
  progress,
  onReady,
  onAction,
}: {
  progress: ExtractionProgress;
  onReady: () => void;
  /** Mantido no contrato por quem monta a tela (`onCancel` fecha o modal/volta ao formulário); este componente é só apresentação e não decide cancelamento sozinho. */
  onCancel?: () => void;
  onAction: (errorKind: ExtractionErrorKind) => void;
}) {
  const { stage, wordCount, errorKind } = progress;

  useEffect(() => {
    if (stage !== 'pronto') return undefined;
    const timer = setTimeout(onReady, READY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [stage, onReady]);

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-6">Processando edital</h3>

      <div className="space-y-4 font-mono text-[12px]">
        <div className={`flex items-center gap-3 ${stage !== 'enviando' ? 'text-[#8e98a8]' : ''}`}>
          {stage !== 'enviando' ? <CheckCircle2 size={16} className="text-[#6b8d00] dark:text-[#80d8a5]" /> : <span className="w-4 h-4 rounded-full border-2 border-r-transparent border-current animate-spin" />}
          <span>Arquivo enviado</span>
        </div>

        <div className={`flex justify-between items-center gap-3 ${stage === 'enviando' ? 'opacity-30' : stage !== 'extraindo' ? 'text-[#8e98a8]' : ''}`}>
          <div className="flex items-center gap-3">
            {stage === 'extraindo' ? <span className="w-4 h-4 rounded-full border-2 border-r-transparent border-current animate-spin" /> :
             stage !== 'enviando' ? <CheckCircle2 size={16} className="text-[#6b8d00] dark:text-[#80d8a5]" /> : <span className="w-4 h-4 opacity-0" />}
            <span>Texto extraído</span>
          </div>
          {!!wordCount && wordCount > 0 && <span className="text-[10px]">{wordCount.toLocaleString('pt-BR')} palavras</span>}
        </div>

        <div className={`flex items-center gap-3 ${stage === 'enviando' || stage === 'extraindo' ? 'opacity-30' : stage === 'pronto' ? 'text-[#8e98a8]' : ''}`}>
          {stage === 'identificando' ? <span className="w-4 h-4 rounded-full border-2 border-r-transparent border-current animate-spin" /> :
           stage === 'pronto' ? <CheckCircle2 size={16} className="text-[#6b8d00] dark:text-[#80d8a5]" /> : <span className="w-4 h-4 opacity-0" />}
          <span>Identificando matérias e tópicos…</span>
        </div>

        <div className={`flex items-center gap-3 ${stage === 'pronto' ? 'text-[#6b8d00] dark:text-[#d5f35b] font-bold' : 'opacity-30'}`}>
          {stage === 'pronto' ? <CheckCircle2 size={16} /> : <span className="w-4 h-4 opacity-0" />}
          <span>Pronto para revisão</span>
        </div>
      </div>

      {stage === 'erro' && errorKind && (
        <div className="mt-6 p-4 bg-[#fff0ee] dark:bg-[#30201f] border border-[#db8f83] dark:border-[#ff907d] text-[#c94f45] dark:text-[#ff907d] rounded-[3px]">
          <p className="text-[12px] font-bold flex items-center gap-2 mb-2"><AlertCircle size={14} /> Falha na leitura</p>
          <p className="text-[11px]">{EXTRACTION_ERROR_MESSAGES[errorKind].message}</p>
          <div className="mt-4 text-right">
            <button
              className="k-button text-[#c94f45] dark:text-[#ff907d] border-current"
              onClick={() => onAction(errorKind)}
              data-testid="button-extraction-error-action"
            >
              {EXTRACTION_ERROR_MESSAGES[errorKind].action}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
