import { useState, type ReactElement } from 'react';
import type { CargoTextBlock } from '@workspace/core';
import type { Cargo } from '@/domain/useWorkspaces';

const ABA_ATIVA = 'bg-white dark:bg-[#202b20] text-[#16232b] dark:text-[#d5f35b] shadow-sm border border-[#d5dede] dark:border-[#35404e]';
const ABA_INATIVA = 'text-[#6f7b85] dark:text-[#8e98a8] hover:text-[#16232b] dark:hover:text-[#f0f0e8]';

function textOf(blocks: readonly CargoTextBlock[], cargoId: string | null): string {
  return blocks.find((block) => block.cargoId === cargoId)?.text ?? '';
}

/**
 * A entrada de texto do edital, dividida por cargo. `cargoId: null` é o bloco comum a
 * todos os cargos — a forma como os editais são de fato publicados (conhecimentos
 * básicos uma vez só, específicos por cargo).
 *
 * Antes desta fase havia um textarea único aplicado a todos os cargos, então todo
 * tópico nascia comum e a deduplicação multi-cargo nunca tinha o que distinguir.
 *
 * Com um cargo só a distinção não existe: as abas somem e sobra o textarea, que é
 * exatamente a tela anterior — nenhum usuário de workspace simples paga por isto.
 */
export function EditalSourceBlocks({
  cargos,
  blocks,
  onChange,
}: {
  cargos: Cargo[];
  blocks: CargoTextBlock[];
  onChange(blocks: CargoTextBlock[]): void;
}): ReactElement {
  const [aba, setAba] = useState<string | null>(null);
  const multiplos = cargos.length > 1;
  const ativo = multiplos ? aba : null;

  const handleChange = (text: string) => {
    const outros = blocks.filter((block) => block.cargoId !== ativo);
    const proximo = [...outros, { cargoId: ativo, text }];
    // Ordem estável: o comum primeiro, depois os cargos na ordem do workspace. Sem
    // isto a lista se reordenaria a cada digitação e o diff de persistência ficaria
    // ruidoso sem nada ter mudado de fato.
    const ordem = [null, ...cargos.map((cargo) => cargo.id)];
    onChange(proximo.slice().sort((a, b) => ordem.indexOf(a.cargoId) - ordem.indexOf(b.cargoId)));
  };

  const preenchido = (cargoId: string | null) => textOf(blocks, cargoId).trim() !== '';

  return (
    <div className="mb-6">
      {multiplos && (
        <>
          <div className="mb-2 flex flex-wrap gap-1 rounded-[4px] border border-[#dfe6e4] bg-[#f1f4f2] p-1 dark:border-[#242a34] dark:bg-[#0b0e13]">
            <button
              type="button"
              onClick={() => setAba(null)}
              className={`flex justify-center rounded-[3px] px-3 py-2 text-[12px] font-medium transition-colors ${ativo === null ? ABA_ATIVA : ABA_INATIVA}`}
              data-testid="bloco-aba-comum"
              data-preenchido={preenchido(null)}
            >
              Comum a todos
              {preenchido(null) && <span className="ml-2 text-[#6b8d00] dark:text-[#8ed9ae]">•</span>}
            </button>
            {cargos.map((cargo) => (
              <button
                key={cargo.id}
                type="button"
                onClick={() => setAba(cargo.id)}
                className={`flex justify-center rounded-[3px] px-3 py-2 text-[12px] font-medium transition-colors ${ativo === cargo.id ? ABA_ATIVA : ABA_INATIVA}`}
                data-testid={`bloco-aba-${cargo.id}`}
                data-preenchido={preenchido(cargo.id)}
              >
                {cargo.name || cargo.id}
                {preenchido(cargo.id) && <span className="ml-2 text-[#6b8d00] dark:text-[#8ed9ae]">•</span>}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] text-[#6f7b85] dark:text-[#8e98a8]">
            {ativo === null
              ? 'Conteúdo cobrado de todos os cargos. Entra uma vez e vale para todos.'
              : `Conteúdo cobrado só de ${cargos.find((cargo) => cargo.id === ativo)?.name || ativo}.`}
          </p>
        </>
      )}
      <textarea
        className="k-input min-h-[150px] resize-y text-[12px]"
        placeholder={ativo === null ? 'Cole aqui o conteúdo programático...' : 'Cole aqui o conteúdo específico deste cargo...'}
        value={textOf(blocks, ativo)}
        onChange={(event) => handleChange(event.target.value)}
        data-testid="bloco-textarea"
        data-cargo={ativo ?? 'comum'}
      />
    </div>
  );
}
