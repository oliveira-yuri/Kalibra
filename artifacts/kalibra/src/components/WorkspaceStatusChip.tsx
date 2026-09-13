import { WORKSPACE_STATUS_LABELS, type WorkspaceStatus } from '@workspace/core';

export function WorkspaceStatusChip({ status }: { status: WorkspaceStatus }) {
  // `estudando` fica neutro (sem modificador — o próprio `k-chip` já é a forma neutra
  // que existe em index.css): o card do Portal já usa `k-chip-active` (o mesmo verde
  // lima) para "workspace ativo" no chip de tipo ao lado deste. Os dois chips lado a
  // lado com o mesmo destaque para significados diferentes tornavam o lima ambíguo —
  // ver regressão M4. `erro` continua com seu próprio tom (coral), que não colide.
  const tone =
    status === 'erro' ? 'border-[#db8f83] text-[#c94f45] dark:border-[#ff907d] dark:text-[#ff907d]' :
    '';

  return (
    <span className={`k-chip ${tone}`} data-testid={`chip-status-${status}`}>
      {WORKSPACE_STATUS_LABELS[status]}
    </span>
  );
}
