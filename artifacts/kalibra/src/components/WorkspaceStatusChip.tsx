import { WORKSPACE_STATUS_LABELS, type WorkspaceStatus } from '@workspace/core';

export function WorkspaceStatusChip({ status }: { status: WorkspaceStatus }) {
  const tone =
    status === 'estudando' ? 'k-chip-active' :
    status === 'erro' ? 'border-[#db8f83] text-[#c94f45] dark:border-[#ff907d] dark:text-[#ff907d]' :
    '';

  return (
    <span className={`k-chip ${tone}`} data-testid={`chip-status-${status}`}>
      {WORKSPACE_STATUS_LABELS[status]}
    </span>
  );
}
