# Fase 4 — Verificação

**Branch:** `fase-4-harness-contrato` · **Plano:** `docs/superpowers/plans/2026-09-20-kalibra-fase-4-harness-contrato.md`
**Spec:** `docs/superpowers/specs/2026-09-14-kalibra-fase-1c-design.md` (§3)

O harness de contrato existe e passa contra o adaptador local, **antes** de
qualquer adaptador de API. Nenhum backend nesta fase.

---

## 1. Contagem final por pacote

| Pacote | Antes da fase | Depois | Delta |
|---|---|---|---|
| `lib/core` | 235 | **235** | 0 — não foi tocado |
| `lib/db` | 44 | **44** | 0 — não foi tocado |
| `artifacts/api-server` | 31 | **31** | 0 — não foi tocado |
| `artifacts/kalibra` | 341 | **395** | +54 |
| **Total** | 651 | **705** | +54 |

Os 54 novos: **20 cenários contra o driver local**, **os mesmos 20 contra o driver
lento**, e **14 testes estruturais**.

**Os 341 testes anteriores não foram modificados.** `git diff main..HEAD
--name-only`, excluindo `src/domain/__contract__/` e os documentos desta fase,
volta vazio — nenhum arquivo de teste anterior aparece.

É a primeira fase desde a 1 em que a contagem do frontend sobe, e isso é por
construção: os cenários vivem dentro daquele pacote. O invariante que permanece é
que nenhum teste existente mudou, não que o número fique parado.

## 2. Portão

```
pnpm run typecheck   # 0 erros
pnpm run build       # exit 0
pnpm run test        # 705
```

**Três fusos, resultado idêntico:**

| `TZ` | `lib/core` | `lib/db` | `api-server` | `kalibra` |
|---|---|---|---|---|
| `UTC` | 235 | 44 | 31 | 395 |
| `America/Sao_Paulo` | 235 | 44 | 31 | 395 |
| `Pacific/Kiritimati` | 235 | 44 | 31 | 395 |

## 3. Os 20 cenários, e o que cada um afirma

Em termos de usuário — nunca de armazenamento, ordem interna ou mecanismo.

### Workspace e cargos

| # | Cenário | A afirmação |
|---|---|---|
| 1 | workspace criado sobrevive a recarregar | Criei um concurso; ele continua lá quando volto. |
| 2 | atualizar um workspace não cria outro | Editei o título; passou a ser o novo, não apareceu um segundo. |
| 3 | atualizar um workspace não afeta outro | Editei um concurso; o outro ficou como estava. |
| 4 | trocar o cargo selecionado persiste, e os dois cargos continuam existindo | Troquei de cargo; a escolha ficou, e o cargo anterior não sumiu. |
| 5 | o cargo padrão tem a data da prova pedida | Um concurso sem cargo nomeado ainda tem um cargo, com a data da prova. |

### Edital

| # | Cenário | A afirmação |
|---|---|---|
| 6 | **prever a extração NÃO grava nada** | Abri a tela de revisão do edital e não confirmei: nada entrou no meu programa, na minha biblioteca nem na fila. |
| 7 | aplicar a proposta grava o que a previsão mostrou | Confirmei: entrou exatamente o que a tela mostrava. |
| 8 | blocos de edital, comum e por cargo, sobrevivem a recarregar | Colei o trecho comum e o do cargo A; os dois continuam lá, cada um no seu lugar. |

### Syllabus

| # | Cenário | A afirmação |
|---|---|---|
| 9 | o mesmo tópico em dois cargos vira UM item com DUAS ligações | "Português" aparece nos dois cargos do edital: é um tópico só, cobrado por dois cargos. |
| 10 | renomear um item preserva sua identidade e suas ligações | Renomeei um tópico; é o MESMO tópico com nome novo, ainda ligado aos mesmos cargos. |
| 11 | ligar e desligar um cargo é observável depois de recarregar | Adicionei o tópico a outro cargo, depois tirei; as duas ações ficaram. |
| 12 | separar de um cargo deixa o outro cargo intacto | Separei o tópico do cargo B; o cargo A segue com o dele, e B passou a ter o seu próprio. |
| 13 | **peso e número de questões vivem na ligação, não no item** | Dei peso 3 ao tópico no cargo A; no cargo B ele continua sem peso. O mesmo assunto vale diferente para cargos diferentes. |

### Conceitos

| # | Cenário | A afirmação |
|---|---|---|
| 14 | **a biblioteca de conceitos é do USUÁRIO, não de um workspace** | Criei tópicos em dois concursos; os conceitos dos dois estão na mesma biblioteca, prontos para reúso. |
| 15 | confirmar um conceito provisório muda seu status | O conceito nasce provisório; só a minha decisão o confirma. |
| 16 | renomear um conceito preserva o nome antigo como alias | Renomeei; o nome do edital vira apelido, para uma reimportação futura casar de volta. |

### Aprovações

| # | Cenário | A afirmação |
|---|---|---|
| 17 | enfileirar deixa um item pendente | A IA propôs; ficou esperando por mim, sem decisão. |
| 18 | aprovar decide o item e registra QUANDO, sem dizer qual instante | Aprovei; ficou registrado que decidi e quando. |
| 19 | rejeitar preserva o motivo | Recusei com uma razão; a razão ficou. |
| 20 | **aprovar uma fusão de conceito confirma o conceito alvo** | Decidi que são o mesmo conceito; o conceito deixou de ser provisório. |

## 4. Guardas load-bearing — provadas por reversão

Cada uma removida mecanicamente, a suíte executada, o teste vermelho registrado,
a guarda restaurada.

### 4.1 Estruturais — o contrato não ganha vocabulário próprio

| # | Reversão | Teste vermelho |
|---|---|---|
| 1 | método `limparArmazenamento` acrescentado ao `Driver` | `cada operação do Driver corresponde a uma operação de porta` |

### 4.2 Textuais — nenhum cenário conhece o adaptador

Sete agulhas plantadas em `cenarios.ts`, uma por vez. **Cada uma reprovou o seu
próprio teste**, não um genérico:

| # | Agulha plantada | Teste vermelho |
|---|---|---|
| 2 | `localStorage` | `cenarios.ts não menciona armazenamento do navegador` |
| 3 | `window.foo` | `cenarios.ts não menciona objeto window` |
| 4 | `dispatchEvent` | `cenarios.ts não menciona evento de janela` |
| 5 | `renderHook` | `cenarios.ts não menciona montagem de hook` |
| 6 | `act(` | `cenarios.ts não menciona act do testing-library` |
| 7 | `from './adapters/x'` | `cenarios.ts não menciona import de adaptador` |
| 8 | `kalibra_workspaces` | `cenarios.ts não menciona chave de armazenamento` |

### 4.3 Semânticas — provadas em CÓDIGO REAL, não em comentário

A distinção importa: uma agulha em comentário prova que a varredura textual
funciona, não que a regra tem efeito sobre o que os cenários fazem.

| # | Reversão | Teste vermelho |
|---|---|---|
| 9 | `unico(...)` trocado por indexação real num cenário | `nenhum cenário indexa array por posição` |
| 10 | todas as chamadas a `unico` removidas | `os cenários usam o caminho autorizado no lugar da indexação` |
| 11 | `ids(...)` trocado de volta por `toHaveLength(antes.length)` | `nenhum cenário afirma contagem total` |

A 10 existe por causa da 9: proibir a indexação sem exigir a saída autorizada
empurraria para a asserção **mais fraca** — alguém remove o `[0]` deixando de
verificar unicidade, e a guarda fica verde tendo piorado o teste.

### 4.4 Cenários — provados contra código de produção

| # | Reversão | Teste vermelho |
|---|---|---|
| 12 | `criarWorkspace` do driver vira no-op | `workspace criado sobrevive a recarregar` |
| 13 | `preverExtracao` passa a gravar o resultado | `prever a extração NÃO grava nada` |
| 14 | `splitItem` neutralizado em `lib/core` | `separar de um cargo deixa o outro cargo intacto` |
| 15 | `applyApprovalSideEffects` neutralizado no adaptador | `aprovar uma fusão de conceito confirma o conceito alvo` |
| 16 | `withAlias` removido de `renameConcept` em `lib/core` | `renomear um conceito preserva o nome antigo como alias` |

As reversões 14, 15 e 16 alcançam **código de produção**, não o harness — são as
que provam que os cenários defendem o domínio, e não a si mesmos. Em cada uma, o
teste ficou vermelho nos **dois** drivers.

Depois de todas, `git diff` em `lib/core` e em `src/domain/adapters/` volta vazio.

## 5. Rede de regressão NÃO provada: o driver lento

**Isto não é uma guarda load-bearing, e não entra na tabela acima.**

`lentidao.test.ts` roda os mesmos 20 cenários contra um driver em que toda
operação atravessa um macrotask antes de executar e outro antes de responder.

**O que mostra:** os 20 passam sob latência. Nenhum depende de a resposta chegar
na hora.

**O que não mostra:** não foi possível construir um cenário **verde no driver
normal e vermelho neste**. Duas tentativas:

| Cenário de verificação | Driver normal | Driver lento |
|---|---|---|
| ler sem `await` | **vermelho** | verde |
| duas mutações concorrentes | **vermelho** | verde |

Nos dois casos o driver lento foi **mais permissivo**, não mais severo — o atraso
dá mais tempo para a operação disparada completar.

**A razão é estrutural**, e vale mais que o arquivo: o `Driver` é uniformemente
assíncrono, e o driver local embrulha cada mutação em `await act(async …)`. Isso
já impõe uma fronteira de microtask a toda operação. **Depender de sincronicidade
não é algo que um cenário consiga expressar** — a interface não deixa. O atraso
extra não abre fresta nova onde um cenário mal escrito pudesse cair.

**Portanto ele prova menos do que o plano dizia.** O plano o chamava de "a prova
de que nenhum cenário depende de imediatismo"; o correto é "os cenários toleram
latência, e não há violação construível para ele pegar".

**Decisão: mantido.** Custa menos de dois segundos, roda os cenários com uma
camada assíncrona a mais, e pode pegar acoplamento futuro. Apagar perderia
cobertura barata; contá-lo como prova seria inventar uma garantia que a execução
não sustenta.

**Reavaliar na Fase 5**, quando o driver de API trouxer latência real,
reordenação e falha parcial — nenhuma das três exercitada aqui.

No caminho, ele revelou um defeito de si mesmo: a primeira versão atrasava só a
**resolução** e executava a operação na hora. Foi o cenário de verificação, ao
ficar vermelho nos dois drivers, que expôs isso. Corrigido para atrasar antes
também — o que HTTP faz — e ainda assim não discrimina, pela razão acima.

## 6. Confirmações

- **Nenhum driver de API existe.** `src/domain/__contract__/` contém oito
  arquivos: `driver.ts`, `cenarios.ts`, `runner.ts`, `auxiliares.ts`,
  `local-driver.ts`, `local.test.ts`, `lentidao.test.ts`, `estrutura.test.ts`.
  Nenhum `api-driver.ts`, nenhum `api.test.ts`.
- **`domainConfig` segue inteiro em `'local'`.** As duas únicas ocorrências de
  `api` no arquivo são a declaração do tipo `ModuleSource` e um comentário; zero
  módulos atribuídos a `'api'`.
- **Nenhum dos 341 testes anteriores foi modificado.**
- **React está confinado a `local-driver.ts`** — é o único arquivo do diretório
  que importa `@testing-library`.
- **`cenarios.ts` está limpo**: a varredura por adaptador, React, armazenamento,
  chave, indexação por posição e contagem total volta zero ocorrências.
- **Produção intacta**: `lib/core` e `src/domain/adapters/` sem diferenças.

---

# 7. O que este harness ainda NÃO prova

## 7.1 Roda contra um adaptador só

**A comparação que dá sentido à fase não aconteceu.** Existe um adaptador real
(local) e uma variação dele (lento). Que os cenários passem contra o local prova
que são executáveis e que descrevem o comportamento de hoje — não que sejam
portáveis.

**A comparação local × API começa na Fase 5.** Até lá, o valor desta fase é ter
sido escrita **antes**: escritos depois, os cenários descreveriam o que o backend
faz em vez do que o domínio promete.

## 7.2 A correspondência `Driver` ↔ portas é estrutural, não semântica

O teste garante que o `Driver` não ganha vocabulário próprio. **Não garante que
`renomearItem` signifique a mesma coisa dos dois lados** — uma correspondência
textual não tem como saber isso.

A prova semântica são os cenários, e só quando rodarem contra os dois adaptadores.

## 7.3 Deduplicação: integração, não algoritmo

`dedupeEntries` vive em `lib/core` e é chamada pelos dois lados. O cenário 9 prova
que a chamada está ligada e que o resultado é persistido e relido corretamente —
**não** prova o algoritmo, que tem os seus próprios 43 testes em `lib/core`.

## 7.4 Nada de concorrência, `If-Match` ou versão

`workspace.version`, os `428`/`412` e a política de concorrência otimista não têm
cenário nenhum. Entram na Fase 5, com o primeiro recurso que aceite escrita.

## 7.5 Nada de falha parcial

Nenhum cenário exercita operação que falha no meio, rede que cai, resposta que
chega pela metade ou repetição de requisição. O adaptador local praticamente não
tem como falhar assim; o de API terá.

## 7.6 O driver lento não prova independência de sincronicidade

Como o §5 detalha: ele prova que os cenários **toleram** latência, não que pegaria
um cenário que dependesse de imediatismo. Nenhuma violação construível.

## 7.7 `staging.ts` está fora do contrato, de propósito

`stageWorkspaceImport` e companhia guardam uma importação em andamento entre duas
telas — por aba, efêmera, nunca compartilhada. **Um adaptador de API não as
implementaria**, então incluí-las no contrato criaria uma obrigação falsa.

## 7.8 Módulos que não migram

`theme`, `notes`, `studyState` e `extraction` ficam fora: não são dos quatro
módulos que migram para a API nesta arquitetura. `extraction` declara tipos
próprios no adaptador legitimamente, e o teste estrutural das portas já registra
essa exceção.

## 7.9 O harness não roda contra Postgres nem Clerk

Herdado das fases anteriores e ainda verdadeiro: nada foi exercitado contra
Postgres real nem contra o Clerk real. A pausa de infraestrutura acordada vem
antes da Fase 5.
