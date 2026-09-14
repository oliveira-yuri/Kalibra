# Fase 1B.5 — conteúdo por cargo: entrada, vínculos e revisão

> **Base: `main`.** As Fases 0, 1A e 1B já estão mergeadas.

A Fase 1B construiu deduplicação multi-cargo no modelo e a testou, mas a interface
tinha **um único textarea aplicado a todos os cargos** — então todo tópico nascia
comum por construção, e a deduplicação nunca teve duas entradas diferentes para
distinguir. Esta fase abre o caminho de entrada que faltava.

## O que mudou

**A entrada do edital virou blocos.** Uma aba "Comum a todos" e uma por cargo,
reusando o mesmo controle segmentado que Arquivo/Texto já usava. É a forma como os
editais são de fato publicados: conhecimentos básicos uma vez só, específicos por
cargo. Com um cargo só as abas somem e sobra o textarea — ninguém paga pela
distinção onde ela não existe.

**Vínculo item ↔ cargo nos dois sentidos.** Já existia "Separar de \<cargo\>";
agora existe "Aplicar a \<cargo\>", oferecido só para os cargos aos quais o item
ainda não está ligado. Peso e quantidade nascem vazios de propósito — herdá-los do
outro cargo inventaria um dado que o edital não afirma, e um número herdado passa
despercebido enquanto um campo vazio pede revisão.

**O que é comum e o que é específico ficou visível.** Antes, um item de um cargo só
não tinha marca nenhuma: na lista consolidada, comum e específico eram
indistinguíveis. Agora a linha diz "comum a todos", "N cargos" ou "só \<cargo\>".

**Conteúdo comum continua sendo UMA entidade** com várias ligações, nunca cópias —
é isso que mantém nota, histórico e FSRS inteiros quando o mesmo tópico é cobrado
em dois cargos.

## Os defeitos que só apareceram executando

**1. O app aceitava texto e o descartava em silêncio — em três lugares.** Um cargo
ainda sem nome recebia uma aba onde dava para digitar, e a extração descartava o
conteúdo sem aviso. Remover um cargo depois de digitar deixava um bloco órfão
persistido. E o campo continuava editável depois do cargo morrer, mostrando e
aceitando texto que o submit ia podar. As duas primeiras metades foram fechadas
durante a execução; a terceira, de interface, só a revisão final pegou.

**2. "Excluir" apagava o item de todos os cargos mesmo com o filtro num cargo só.**
O código é anterior a esta fase, mas a armadilha só agora era alcançável: até a
Fase 1B todo item era comum a todos, então "excluir daqui" e "excluir de tudo" eram
a mesma operação. Foi esta fase que criou conteúdo genuinamente por cargo e, com
isso, transformou um botão inofensivo numa violação de "alterar um cargo não
contamina os demais". Agora `unlinkItemFromCargo` remove só a ligação daquele cargo
— levando os subtópicos junto, e excluindo o item quando era a última — e o menu
nomeia o alcance em vez de ser ambíguo.

**3. A correção de um achado introduziu uma regressão pior que o defeito.** Ao
fechar a gravação de blocos, o ramo "Arquivo" passou a escrever `[]`. Como a
migração trata "o array existe" como "já migrado", isso destruía blocos salvos e
tornava o `sourceText` de um registro legado permanentemente inacessível.

**4. Meu próprio plano tinha três defeitos que o typecheck ou a execução pegaram:**
um literal de teste sem três campos obrigatórios (invisível no vitest, que não checa
tipos); código de teste usando matchers de `@testing-library/jest-dom`, pacote que
não existe neste repositório; e testes semeando `kalibra_workspaces` quando
`getWorkspaces()` lê `kalibra_workspaces:anonymous` — com a chave errada eles
cairiam no fallback de demonstração e passariam pelo motivo errado.

Cada correção tem teste que fica **vermelho** quando revertida mecanicamente. Na
onda final foram sete reversões, todas reproduzidas de forma independente pela
re-revisão com contagens idênticas.

## Verificação

```
pnpm run typecheck   # 4 pacotes
pnpm run test        # 564 testes (231 lib/core + 333 frontend)
pnpm run build       # 3 artifacts
```

Suíte idêntica em `TZ=UTC`, `America/Sao_Paulo` e `Pacific/Kiritimati`, **zero
snapshots reescritos**. `lib/core` continua puro — sem relógio, sem I/O, verificado
por varredura no pacote inteiro. Nenhuma tela toca armazenamento direto.

Design system: `index.css` **não foi tocado**. Nenhuma cor, raio, fonte ou token
novo — o componente de blocos compõe as mesmas classes do controle segmentado que
já existia, e os itens de menu novos usam as mesmas do "Separar de".

Os sete critérios de aceite foram verificados por execução ponta a ponta, e cada um
dos testes que os fixa foi provado não-vacuoso quebrando o código de produção que
ele protege.

## Limites conhecidos

- **`workspace.sourceBlocks` é write-only.** Nenhuma tela pré-carrega os blocos
  salvos ao reabrir o editor, então a edição por cargo vale uma sessão. Primeiro da
  fila — com o cuidado de não pré-carregar blocos de uma importação já superada por
  uma reimportação em modo Arquivo.
- **`Edital.tsx` tem sua própria implementação do chip** (`N cargos`, sempre) e não
  ganhou "comum a todos" nem "só \<cargo\>": duas telas mostram a mesma árvore com
  marcações diferentes.
- **Digitar antes de nomear um cargo** deixa o texto classificado como "comum" sem
  aviso. Reclassificação silenciosa, não perda — o texto continua visível e
  editável na aba "Comum a todos".
- **Separar e aplicar não levam os subtópicos junto** (pré-existente): separar uma
  disciplina de um cargo cria o item novo sem filhos, e os tópicos ficam flutuando.
- **`dedupeEntries` continua quadrático e síncrono na tela.** Esta fase aumenta o
  volume de entradas reais, então o problema fica mais visível.
- **Não existe campo de "prioridade" no modelo.** Peso e quantidade de questões
  existem por ligação e esta fase os cobre; prioridade não foi inventada aqui.
- **A conferência visual manual nos dois temas não foi feita** — falta
  `VITE_CLERK_PUBLISHABLE_KEY` neste ambiente. Registrado como não feito, não
  presumido.

## Documentos

- Spec: `docs/superpowers/specs/2026-09-12-kalibra-design.md`
- Plano: `docs/superpowers/plans/2026-09-14-kalibra-fase-1b5.md`
- Verificação: `docs/superpowers/plans/2026-09-14-kalibra-fase-1b5-verificacao.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
