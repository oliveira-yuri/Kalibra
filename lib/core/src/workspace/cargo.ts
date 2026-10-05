/**
 * Um cargo do concurso.
 *
 * O tipo morava em `domain/ports`, junto com a porta de workspaces, e veio para cá
 * na Fase 5 pelo mesmo motivo que `SourceMode`: a API precisa dele para o
 * contrato, e `lib/db` para o schema. Um tipo de domínio que duas camadas leem não
 * pertence à porta de nenhuma delas.
 */
export type Cargo = {
  id: string;
  name: string;
  examDate: string;
  period?: string;
};

/**
 * O cargo sintético de um workspace sem cargo nomeado.
 *
 * **Era uma operação de porta, e não devia ser.** Não lê, não escreve, não
 * consulta sessão nem banco: é regra de domínio pura, e uma porta existe para o
 * que tem duas implementações diferentes. Ter `defaultCargo` na porta obrigava o
 * adaptador de API a inventar uma resposta — ou um endpoint que faria uma viagem
 * de rede para computar o que o cliente computa sozinho.
 *
 * Aqui, os dois lados chamam a mesma função, e o contrato ficou menor.
 *
 * `WorkspaceDraft.cargos` é obrigatório e não pode ficar vazio: um array vazio
 * deixaria a seleção apontando para nada (regressão I3 da Fase 1). Esta é a fonte
 * única do que "sem cargo" significa — centralizada para que a migração de
 * registros antigos e a criação de workspace novo nunca divirjam.
 */
export function defaultCargo(examDate: string): Cargo {
  return { id: 'c1', name: 'Cargo único', examDate };
}
