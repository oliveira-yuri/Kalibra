# Fase 1B — edital, deduplicação por conceito e fila de aprovações

> **Base: `fase-1a-core-workspace`**, não `main`. As três branches estão
> empilhadas: Fase 0 → Fase 1A → Fase 1B. Mergear na ordem.

A fase que dá ao Kalibra a espinha do domínio: o edital entra como arquivo e sai
como estrutura estudável, revisada e aprovada por humano antes de virar programa
oficial.

## O que mudou

**A espinha `concept → syllabus_item → syllabus_item_cargo`.** O `concept` é
global por usuário, o `syllabus_item` pertence ao workspace, e a ligação N:N
carrega peso e quantidade de questões. A deduplicação vive aí como
cardinalidade: um tópico cobrado em dois cargos é **um** item ligado duas vezes,
não dois itens — então nota, histórico e FSRS não se partem em dois.

**Upload e extração do edital**, com revisão obrigatória antes de qualquer coisa
virar estrutura oficial (§4.4, PD-06). A tela permite renomear, excluir,
adicionar e separar um item que a deduplicação uniu.

**Comparação entre versões do edital (PD-08).** Reimportar uma retificação mostra
o que entrou, o que saiu e o que foi **renomeado** — e renomeação não dispara o
aviso de perda de histórico, porque renomear não perde histórico.

**Fila de aprovações** com `payload_before`/`payload_after`, decisão em lote por
tipo, e `concept_merge` como o mecanismo que reconcilia conceitos duplicados na
biblioteca global.

**Matching de conceito conservador (R2/R3/R4).** Liga direto só quando o match
passa do limiar **e** o conceito encontrado já está `confirmed`. Abaixo disso,
vira proposta na fila. A biblioteca global não se polui sozinha.

## Os defeitos que só apareceram executando o código

Seis rodadas de revisão. As três últimas não encontraram erro de execução
nenhum — encontraram **junções**: peças corretas, testadas, sem ninguém do outro
lado.

**1. A detecção de renomeação não podia funcionar, porque nada gravava um alias.**
`diffSyllabus` lia aliases corretamente e tinha teste. Só que todo escritor punha
`aliases: []` e nenhum acrescentava. Rodando o exemplo do próprio spec, `"Crase"`
→ `"Emprego do acento indicativo de crase"` saía como *removido + adicionado*,
disparando o aviso coral de perda de histórico numa renomeação — exatamente o que
o PD-08 existe para impedir. A metade produtora nunca tinha sido escrita.

**2. `concept_merge` não mesclava.** Aprovar promovia o conceito alvo a
`confirmed` e ignorava o `itemId` que o próprio payload carregava. Cada
reimportação fazia a biblioteca global crescer em um duplicado por item, para
sempre, sem caminho de reconciliação.

**3. Uma entrada obsoleta da fila sequestrava a importação seguinte.** A versão
comparada era um literal na URL, não um contador. Importar um edital, sair sem
decidir e importar outro fazia a tela ressuscitar a proposta *anterior* — e
confirmar gravava o edital errado.

**4. E a correção do item 3 quebrou o PD-08 para quem já tinha dados.** O
contador começava em 1 num workspace sem chave gravada, e o bloco de comparação
estava atrás de um `version !== '1'`. Todo workspace existente reimportava sem
ver diff nenhum. A versão agora é apurada da realidade — do que a fila e o
programa salvo nomeiam — e a comparação depende de existir programa anterior, não
do número.

**5. Uma correção reportada como feita, que não estava.** O `useMemo` do diff
dependia de `review`, recriado a cada tecla digitada num campo de peso. Medido: 1
`diffSyllabus` completo por tecla, 339 ms a 260 itens, com um comentário no
código afirmando o contrário. As dependências agora são só o que uma edição de
peso não pode tocar.

**6. O retry do confirmar duplicava a biblioteca global.** Pior que o defeito que
substituiu: com o confirmar retentável, uma falha de cota no meio da sequência
fazia a tentativa seguinte reapender conceitos já gravados, com **ids
duplicados** — corrupção que o trinco-morto anterior não conseguia produzir.
`addConcept` é idempotente por id, e a escrita durável acontece antes da memória.

**7. Registro corrompido ressuscitava dados de demonstração.** `getWorkspaces`
tratava "chave ausente", "não é array" e "JSON lançou" como o mesmo caso e
devolvia as fixtures. Agora só a ausência semeia; o registro ilegível é
preservado em vez de sobrescrito.

Cada correção tem teste que fica **vermelho** quando o guard é revertido
mecanicamente — os dois mais críticos foram reconferidos à mão (`4→1` no diff por
tecla, `4→6` na duplicação de conceitos).

## Verificação

```
pnpm run typecheck   # 4 pacotes
pnpm run test        # 479 testes (204 lib/core + 275 frontend)
pnpm run build       # 3 artifacts
```

Suíte idêntica em `TZ=UTC`, `America/Sao_Paulo` e `Pacific/Kiritimati`, **zero
snapshots reescritos**. `lib/core` continua puro — sem relógio, sem I/O,
verificado por varredura. Nenhuma tela toca armazenamento direto.

Design system: `index.css` **não foi tocado**. Nenhuma cor, raio, fonte ou token
novo. Conferência visual manual feita nos dois temas, com o dark validado
primeiro.

## Limites conhecidos

- **`dedupeEntries` é quadrático e roda síncrono na tela.** Um edital de ~500
  tópicos em dois cargos congela a aba por segundos. Precisa de worker ou effect.
- **A UI tem um único textarea aplicado a todos os cargos**, então conteúdo por
  cargo ainda não tem como ser expresso — a deduplicação não tem caminho de
  entrada real ainda. É a lacuna mais importante da fase.
- **`Dashboard` e `Shell` ainda leem mock de `@/data`** enquanto `Edital` lê o
  programa real: duas telas descrevendo editais diferentes.
- **Aprovar um `concept_merge` deixa um conceito provisório órfão**, uma vez por
  item (não cresce a cada reimportação). Coletá-lo exigiria alcançabilidade sobre
  a biblioteca global inteira — e apagaria tudo quando o registro de workspaces
  estivesse ilegível.
- **`workspaceId` guarda um slug**, que o schema do servidor terá de reconciliar
  na Fase 2.
- **Renomear na tela de revisão um item ligado a conceito já `confirmed`** altera
  só o rótulo do item; o caminho equivalente para item confirmado
  (`useSyllabus.renameItem`) grava o alias.

## Documentos

- Spec: `docs/superpowers/specs/2026-09-12-kalibra-design.md`
- Plano: `docs/superpowers/plans/2026-09-13-kalibra-fase-1b.md`
- Verificação: `docs/superpowers/plans/2026-09-13-kalibra-fase-1b-verificacao.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
