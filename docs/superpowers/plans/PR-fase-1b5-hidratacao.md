# Correção 1B.5 — reabrir o editor pré-carrega os blocos salvos

> **Base: `fase-1b5-conteudo-por-cargo`**, não `main`. Depende do PR da Fase 1B.5,
> que ainda está aberto. Mergear a 1B.5 primeiro; esta rebaseia limpo em seguida.

Fecha o primeiro limite conhecido da Fase 1B.5: **`sourceBlocks` era write-only.**
Os blocos por cargo eram gravados no registro do workspace, mas o estado da tela
nascia vazio — então reabrir o modal de reimportação mostrava campos em branco, e a
edição por cargo valia uma sessão só.

## O que mudou

Uma tela, 33 linhas, quase todas comentário. `NovoWorkspace` não precisou de nada:
é criação, o workspace ainda não existe, não há o que carregar. O caso real era o
modal de reimportação em `Edital.tsx`.

**A hidratação acontece na abertura do modal, não num efeito.** Um efeito que
observasse `workspace` re-sincronizaria enquanto o usuário digita — e como a própria
tela grava no registro, ela apagaria o que ele acabou de escrever. Abrir o modal é o
único momento em que hidratar não atropela ninguém.

**Só hidrata quando a última importação foi por texto.** Os blocos salvos descrevem
a última importação apenas nesse caso. Se depois dela o usuário reimportou por
arquivo, aquele texto já foi superado: trazê-lo de volta sugeriria que o edital
vigente veio dali, e salvá-lo sem perceber reintroduziria conteúdo obsoleto. Nesse
caso o modal abre como antes, vazio, na aba Arquivo.

**Quando hidrata, abre já na aba "Texto".** Carregar o conteúdo e deixá-lo atrás da
aba "Arquivo" não é "os blocos aparecem como estavam salvos".

**Compatibilidade com dado antigo saiu de graça:** `blocksFrom` (`workspaces.ts`) já
converte o `sourceText` legado num bloco comum na leitura, então a tela recebe blocos
válidos sem precisar saber que o registro é anterior à Fase 1B.5.

## Um teste existente precisou de ajuste

O teste do achado C1 assumia que o modal abre na aba "Arquivo". Com blocos salvos ele
agora abre em "Texto", então o teste passa a clicar em "Arquivo" primeiro. A asserção
que ele protege é idêntica e ficou **mais forte**: `sourceBlocks` agora está populado
no estado da tela quando o ramo "Arquivo" roda, e mesmo assim a chave não pode ser
gravada por cima do que já existia.

## Verificação

```
pnpm run typecheck   # 4 pacotes
pnpm run test        # 570 testes (231 lib/core + 339 frontend), +6 novos
pnpm run build       # verde
```

Suíte idêntica em `TZ=UTC`, `America/Sao_Paulo` e `Pacific/Kiritimati`, **zero
snapshots reescritos**. `index.css` intocado, nenhum token novo, visual idêntico.

Os seis testes novos cobrem gravação, reabertura com blocos pré-carregados, e os dois
fallbacks (registro legado sem `sourceBlocks`, e registro sem nada salvo). Provados
não-vacuosos: revertendo a hidratação, exatamente os quatro que dependem dela ficam
vermelhos, e os dois que testam o caso "não hidratar" continuam verdes.

## Nota sobre a descrição do PR da Fase 1B.5

O corpo daquele PR ainda lista "`workspace.sourceBlocks` é write-only" entre os
limites conhecidos. Com estes dois PRs mergeados, esse item deixa de valer.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
