/**
 * O vocabulário de asserção do harness.
 *
 * Vive fora de `cenarios.ts` por uma razão mecânica: `estrutura.test.ts` varre
 * aquele arquivo em busca de indexação por posição, e a implementação de `unico`
 * precisa justamente pegar um elemento de um array. Misturados, o auxiliar que
 * existe para eliminar a indexação seria a única indexação restante — e a guarda
 * teria de ganhar uma exceção, que é como guarda começa a não valer.
 *
 * Separados, `cenarios.ts` fica sob a regra sem exceção nenhuma.
 */

/**
 * O único elemento de um array que deveria ter exatamente um.
 *
 * Existe para que nenhum cenário indexe por posição. Indexar afirma ordem sem
 * dizer que afirma — e ordem é a primeira coisa que muda quando a leitura passa a
 * vir de um `select` sem `order by`. Filtrar antes não salva: um array de tamanho
 * 1 hoje é um array de tamanho 2 amanhã, e a indexação continuaria verde
 * afirmando sobre o primeiro de dois.
 *
 * Aqui a intenção fica explícita, e um array com zero ou dois elementos falha com
 * o contexto no texto, em vez de afirmar silenciosamente sobre `undefined`.
 */
export function unico<T>(itens: readonly T[], contexto: string): T {
  const [primeiro] = itens;
  if (itens.length !== 1 || primeiro === undefined) {
    throw new Error(`esperava exatamente 1 em "${contexto}", veio ${itens.length}`);
  }
  return primeiro;
}

/**
 * Ids ordenados — a forma de comparar duas leituras sem afirmar ordem.
 *
 * É o que substitui contagem nos cenários de não-mutação. Comparar tamanhos
 * passaria se um registro fosse trocado por outro; comparar o conjunto de ids não.
 */
export function ids(itens: readonly { id: string }[]): string[] {
  return itens.map((i) => i.id).sort();
}

export function idsDeItens(s: { items: readonly { id: string }[] }): string[] {
  return ids(s.items);
}
