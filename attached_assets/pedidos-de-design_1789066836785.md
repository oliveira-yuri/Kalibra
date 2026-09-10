# Pedidos de alteração de design

Cada bloco abaixo é **autocontido**: pode ser copiado e colado isoladamente na ferramenta de design, sem precisar de mais nenhum contexto.

Ordem de prioridade: PD-01 a PD-05 travam etapas do desenvolvimento. PD-06 a PD-11 podem vir depois.

Regra geral que vale para todos: **preservar a identidade visual existente** — Space Grotesk, DM Mono, verde-limão `#d5f35b` (escuro) e `#6b8d00` (claro), coral `#ff907d` para risco, classes `k-*`, temas claro e escuro, cantos de 3px em botões e chips.

---

## PD-01 — Seletor de cargo no shell do workspace

**Problema:** um mesmo concurso pode ter mais de um cargo, com provas separadas e conteúdos programáticos diferentes. No SETEC Campinas o usuário presta dois: Agente de Suporte Técnico (nível médio) e Analista Técnico em Informática (nível superior). As duas provas são no mesmo dia, em períodos diferentes. Português e Matemática são idênticos nos dois; só as específicas mudam.

Hoje a sidebar mostra apenas o nome do concurso, sem forma de alternar entre cargos.

**Onde:** sidebar, no bloco "workspace ativo", abaixo do nome do concurso.

**O que fazer:** transformar a linha do nome do concurso em um seletor. Fechado, mostra o cargo atual. Aberto, lista os cargos daquele concurso.

Estado atual do bloco:

```
workspace ativo
Concurso SETEC Campinas
📅 17 JAN 2026            D−42
```

Estado desejado:

```
workspace ativo
Concurso SETEC Campinas
[ Analista Técnico (Informática)  ▾ ]     ← seletor
📅 17 jan 2027 · período A         D−129
```

**Detalhes:**

- A data e a contagem regressiva passam a ser do cargo selecionado, não do concurso.
- Mostrar o período da prova (A ou B) ao lado da data, porque é o que permite prestar dois cargos.
- Um concurso com um cargo só deve exibir o seletor desabilitado ou omitido — não criar tela vazia.
- A troca de cargo mantém a rota atual (se estava em `/edital`, continua em `/edital`).

---

## PD-02 — Captura de confiança na tela Questões

**Problema:** hoje a tela registra apenas se a resposta foi certa ou errada. Isso não distingue quatro situações muito diferentes:

| | Acertou | Errou |
|---|---|---|
| **Confiança alta** | domínio real | **crença errada — o caso mais grave** |
| **Confiança baixa** | chute com sorte — falso domínio | lacuna conhecida |

Sem esse dado, "acertei" e "chutei e deu certo" viram a mesma coisa, e o sistema recomenda estudar o lugar errado.

**Onde:** tela Questões, entre selecionar a alternativa e ver o gabarito.

**O que fazer:** depois que o usuário clica numa alternativa, **antes** de revelar se está certa, mostrar uma linha de três botões:

```
Qual sua confiança nesta resposta?
[ Baixa ]  [ Média ]  [ Alta ]
```

Só depois de escolher é que o gabarito e a explicação aparecem.

**Detalhes:**

- Três botões lado a lado, no estilo dos `k-chip`, ocupando a largura do bloco de alternativas.
- Não deve ser possível pular: o gabarito só aparece após a escolha.
- Depois de revelado, mostrar a confiança escolhida junto ao resultado, em texto pequeno: *"você respondeu com confiança alta"*.
- Quando a combinação for **errou com confiança alta**, destacar em coral com uma frase curta: *"Erro com convicção — prioridade máxima de revisão."*

---

## PD-03 — Tela Revisão: trocar flashcards por recuperação escrita

**Problema:** a tela Revisão é hoje um baralho de flashcards com os botões Errei · Difícil · Bom · Fácil. O produto decidiu não gerenciar flashcards: eles são exportados para o Anki, que faz isso melhor e tem aplicativo de celular. O que o app precisa medir é **recuperação livre** — a pessoa escrever de memória o que sabe de um tópico, o que é um sinal muito mais forte que reconhecer o verso de um cartão.

**Onde:** tela Revisão (`/revisao`), substituindo o conteúdo atual. O item de navegação e o contador de pendências continuam.

**O que fazer:** um fluxo em três passos na mesma tela.

**Passo 1 — escrever de memória**

```
REVISÃO 1 / 3            Matemática · Porcentagem e juros simples

Escreva, sem consultar nada, o que você lembra deste tópico.

┌──────────────────────────────────────────────┐
│                                              │
│  (área de texto grande, ~10 linhas)          │
│                                              │
└──────────────────────────────────────────────┘

☐ Escrevi à mão antes de transcrever

                              [ Revelar minha nota ]
```

**Passo 2 — comparar**

Depois de clicar, a tela divide em duas colunas: à esquerda o que a pessoa escreveu, à direita a nota que ela tinha salvo daquele tópico. Se não houver nota, mostrar estado vazio com link para criar.

**Passo 3 — autoavaliar**

```
O quanto você recuperou?

[ Nada ]   [ Parcial ]   [ Bom ]   [ Completo ]
```

Abaixo dos botões, mostrar o efeito de cada um antes de clicar, em texto pequeno e monoespaçado:

```
Nada      próxima revisão em 1 dia
Parcial   próxima revisão em 3 dias
Bom       próxima revisão em 16 dias
Completo  próxima revisão em 35 dias
```

**Detalhes:**

- A caixa "Escrevi à mão antes de transcrever" existe porque a prova tem uma parte dissertativa manuscrita e letra ilegível zera a nota. O app incentiva o papel primeiro.
- Manter o visual do cartão atual (`k-card`, mesma largura máxima, mesma centralização).

---

## PD-04 — Modo dissertativa dentro de Estudo

**Problema:** a prova tem uma **questão dissertativa eliminatória**, escrita à mão, valendo 10 pontos. Metade da nota é português formal: coesão, pontuação, concordância, regência, acentuação. Não existe nada no design para treinar isso.

**Onde:** tela Estudo, como uma nova aba ao lado de `explicação · flashcards · questões · resumo · erros`. Nome da aba: **dissertativa**.

**O que fazer:**

```
QUESTÃO TEÓRICO-PRÁTICA

[ enunciado da questão, 2-4 linhas ]

Escreva à mão, em papel, respeitando o limite de linhas.
Depois transcreva aqui para receber a avaliação.

┌──────────────────────────────────────────────┐
│  (área de texto grande, ~15 linhas)          │
└──────────────────────────────────────────────┘

linhas escritas: 18 / 30                    [ Avaliar ]
```

Depois de avaliar, mostrar os três critérios oficiais com nota e comentário:

```
NOTA: 7,5 / 10

Tema                              4,0 / 5,0
  atende parcialmente ao problema

Estrutura do período e parágrafo  2,0 / 2,5
  poucas falhas de progressão

Domínio do estilo formal          1,5 / 2,5
  concordância no 2º parágrafo
  crase indevida antes de verbo
  acentuação: "critérios"
```

**Detalhes:**

- Os três critérios e suas notas máximas são fixos: Tema 0–5, Estrutura 0–2,5, Estilo 0–2,5.
- O contador de linhas importa porque escrever menos que o mínimo zera a nota na prova real.
- Os apontamentos de estilo devem ser uma lista de itens curtos, não um parágrafo corrido — é o que a pessoa vai reler antes da prova.

---

## PD-05 — Registro rápido de prática feita fora do app

**Problema:** a maior parte das questões vai ser resolvida em plataformas externas (Qconcursos e similares), não dentro deste app. Se esse volume não for registrado, o sistema enxerga só uma fração do estudo real e todas as recomendações passam a se basear em dados incompletos.

O registro precisa ser **rápido a ponto de a pessoa não desistir de fazê-lo**. Trinta segundos já é demais.

**Onde:** dois lugares.

1. Em cada linha da lista de tópicos da tela Edital, um ícone discreto de "registrar prática".
2. Um botão global no cabeçalho, ao lado da busca.

**O que fazer:** um popover pequeno, não um modal de página inteira.

```
Registrar prática externa

Tópico    [ Porcentagem e juros simples   ▾ ]
Fiz       [  20 ]     Acertei  [  13 ]

                          [ Registrar ]
```

**Detalhes:**

- Três campos, um clique. Nada de data (assume hoje), nada de fonte obrigatória, nada de observação obrigatória.
- Ao registrar, fechar sozinho e mostrar um toast curto: *"20 questões registradas em Porcentagem · 65%"*.
- Se aberto pela linha do tópico, o campo Tópico já vem preenchido e some do formulário.

---

## PD-06 — Tela de revisão da estrutura extraída do edital

**Problema:** hoje o envio do edital termina em "enviado" e a estrutura aparece pronta. Na versão real, o backend extrai matérias e tópicos do documento e **isso precisa ser conferido por uma pessoa antes de virar dado**, porque extração automática erra.

**Onde:** tela nova, entre o envio do edital e o workspace montado. Rota sugerida: `/workspace/:slug/edital/revisar/:versao`.

**O que fazer:** uma árvore editável do que foi extraído.

```
ESTRUTURA EXTRAÍDA DO EDITAL          versão 1 · 123 tópicos encontrados

Revise antes de confirmar. Você pode renomear, mover, excluir e adicionar.

▾ Língua Portuguesa                    10 questões
    Interpretação de texto                    ⋮
    Ortografia oficial                        ⋮
    Crase                                     ⋮
    + adicionar tópico

▾ Matemática                           10 questões
    ...

▾ Conhecimentos Específicos            20 questões
    ...

⚠ Não encontrado no edital
    peso das matérias
    data da prova

                    [ Descartar ]   [ Confirmar estrutura ]
```

**Detalhes:**

- Cada tópico tem menu com: renomear, mover para outra matéria, excluir.
- Cada matéria tem "+ adicionar tópico" ao final.
- **O bloco de "não encontrado" é obrigatório e não pode ser preenchido com valor inventado.** Quando a extração não achar um dado, ele aparece nessa lista, vazio, para a pessoa preencher se quiser.
- Enquanto não confirmar, nada é gravado no workspace.

---

## PD-07 — Estados reais do processamento do edital

**Problema:** o envio do edital hoje mostra sucesso imediato. No real, extrair texto de um PDF e estruturar o conteúdo leva de segundos a um minuto, e pode falhar de várias formas diferentes.

**Onde:** modal de envio do edital (tela Edital) e tela de novo workspace.

**O que fazer:** um indicador de progresso com quatro etapas nomeadas.

```
✓ Arquivo enviado
✓ Texto extraído              12.480 palavras
◐ Identificando matérias e tópicos…
○ Pronto para revisão
```

**Estados de erro, cada um com mensagem própria e ação:**

| Situação | Mensagem | Ação |
|---|---|---|
| PDF sem camada de texto (escaneado) | "Este PDF é uma imagem, não texto. Não é possível extrair o conteúdo automaticamente." | "Colar o texto manualmente" |
| Arquivo corrompido | "Não foi possível abrir o arquivo." | "Enviar outro arquivo" |
| Texto curto demais | "O conteúdo enviado tem apenas 40 palavras. Verifique se é o edital completo." | "Enviar mesmo assim" / "Trocar" |
| Falha na estruturação | "O conteúdo foi extraído, mas não conseguimos identificar a estrutura." | "Tentar de novo" / "Montar manualmente" |

**Detalhes:** nunca mostrar spinner sem texto. A pessoa precisa saber em qual etapa está e quanto falta.

---

## PD-08 — Comparação entre versões do edital

**Problema:** editais são republicados com retificações. Quando uma nova versão chega, a pessoa precisa ver o que mudou antes de aceitar — senão perde o progresso de tópicos que continuam existindo.

**Onde:** depois de processar uma nova versão, antes de confirmar. Mesma tela do PD-06, com um bloco a mais no topo.

**O que fazer:**

```
COMPARADO COM A VERSÃO 1

+ 4 adicionados
    Português · Semântica e figuras de linguagem
    Específicas · Lei nº 14.133/2021 — nova redação
    ...

− 2 removidos
    Específicas · Noções de logística
    ⚠ este tópico tem 34 questões respondidas e 3 erros registrados

~ 1 renomeado
    "Crase" → "Emprego do acento indicativo de crase"
```

**Detalhes:**

- Tópicos removidos que já têm histórico de estudo precisam do aviso em coral. O dado não é apagado — o tópico sai da lista ativa e o histórico fica.
- Renomeados devem ser tratados como o mesmo tópico, não como remoção + adição.

---

## PD-09 — Correções de conteúdo na interface

Valores de demonstração que não batem com o edital real e precisam virar dado dinâmico:

| Onde | Está | Deve ser |
|---|---|---|
| Pesos das matérias | 35 / 30 / 35 | vindo do edital (no SETEC: 25 / 25 / 50) |
| Alternativas por questão | 5 (A–E) | **4 (A–D)** — e deve acompanhar o edital |
| Data da prova | 17 JAN 2026 | vinda do cargo selecionado |
| Contagem regressiva | `D−42` fixo | calculada a partir de hoje |
| Data no cabeçalho | "quarta, 17 dez" fixa | data real |
| Horário no cabeçalho | "08:42 BRT" fixo | hora real ou remover |

---

## PD-10 — Aba Flashcards vira "Cards para o Anki"

**Problema:** a aba flashcards da tela Estudo mostra um baralho para revisar dentro do app. O produto exporta os cards para o Anki em vez de gerenciá-los.

**Onde:** tela Estudo, aba `flashcards`.

**O que fazer:** trocar o baralho por uma lista dos cards gerados a partir dos seus erros neste tópico, com o estado de cada um.

```
CARDS DESTE TÓPICO

○ rascunho    Qual é o fator de um aumento de 18%?          [ aprovar ]
✓ aprovado    Em redução, o resultado é maior ou menor?
↗ exportado   Como aplicar duas variações seguidas?          há 2 dias

                                    [ Gerar card a partir de um erro ]
```

**Detalhes:** os cards vão para o Anki por integração automática. A tela só decide **o que merece virar card**, não drila.

---

## PD-11 — Tela de prova diagnóstica

**Problema:** a cada duas semanas o usuário faz uma prova no formato real para medir onde está. O design menciona "simulado" apenas como item de calendário; não existe a tela.

**Onde:** rota nova dentro do workspace, sugerida `/workspace/:slug/diagnostico`. Novo item na navegação, entre Questões e Erros.

**O que fazer:** três telas.

**Antes** — confirmação do formato:

```
PROVA DIAGNÓSTICA · CICLO 04
Analista Técnico (Informática)

40 questões · 3h30 · formato real da prova
10 Português · 10 Matemática · 20 Específicas

Todas as questões são inéditas para você.

                              [ Começar agora ]
```

**Durante** — modo foco: sem sidebar, cronômetro regressivo no topo, navegação entre questões, marcar para revisar. Confiança por questão continua sendo pedida.

**Depois** — relatório:

```
27 / 40 acertos · 67,5%          linha de corte: 20 acertos

Por seção
  Português      8/10    80%
  Matemática     6/10    60%
  Específicas   13/20    65%

Acerto × confiança
                  acertou    errou
  confiança alta     18        4     ← 4 erros com convicção
  confiança baixa     9        9

Comparado ao diagnóstico anterior
  Português    +2    Matemática    −1    Específicas   +4
```

**Detalhes:** o quadrante "errou com confiança alta" é o dado mais importante do relatório e deve ter destaque visual — é onde a pessoa acredita em algo errado.
