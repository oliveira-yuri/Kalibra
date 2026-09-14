# Kalibra — spec de design da V1

**Data:** 12 de setembro de 2026
**Escopo:** V1 completa, construída em fases incrementais sobre o frontend existente.
**Fontes:** `kalibra-brief-final-para-claude-code.md`, o frontend em `frontend-replit/Kalibra-Study-Workspace (1)/Kalibra-Study-Workspace`, e `attached_assets/pedidos-de-design_1789066836785.md` (PD-01 a PD-11).

---

## 1. Regra principal

O frontend existente é a base obrigatória. Ele não é recriado, redesenhado nem substituído. Funcionalidades novas se encaixam nos padrões que já existem; telas novas nascem compostas de padrões atuais e devem parecer que sempre pertenceram ao produto. O backend é planejado para servir esse frontend, nunca para forçar reestruturação visual.

O Kalibra é um sistema de retenção e preparação para prova: conteúdo entra, vira estrutura estudável, o aluno pratica, os erros são registrados, revisões são agendadas, e o sistema recalibra o plano com base no desempenho real.

---

## 2. Decisões tomadas

| # | Decisão | Consequência |
|---|---|---|
| D1 | V1 contém todo o escopo definido, construída em fases incrementais | Mock é andaime de desenvolvimento, não entrega final |
| D2 | Flashcards têm o Anki como destino principal | Kalibra gera e exporta (CSV/TSV/APKG); AnkiConnect fica pós-V1 |
| D3 | FSRS interno governa apenas o que acontece dentro do Kalibra | Revisão ativa, questões erradas, tópicos frágeis, recomendações |
| D4 | Sidebar agrupada em **5 seções temáticas**: navegação, conteúdo, prática, revisão, inteligência | Rótulos no estilo `k-eyebrow` já existente |
| D5 | O **backend e o worker** do Kalibra chamam a Claude API; Hermes cobre pesquisa web | O frontend chama apenas a API do Kalibra. Nenhuma chave de modelo chega ao navegador |
| D6 | `/sessoes` orquestra; `/estudo` vira destino de bloco | A tela `/estudo` não muda e sai da sidebar |
| D7 | VPS/Docker próprio é a infraestrutura final, planejada desde o início | A **implementação** da infra entra na Fase 2; a Fase 1 continua sendo frontend completo com adaptadores locais |
| D8 | Abordagem A: camada de domínio com adaptadores trocáveis | Telas nunca chamam `fetch` nem `localStorage` |
| D9 | Dark é o tema padrão | Identidade validada primeiro no dark; claro continua existindo |

### Restrições registradas pelo usuário

- **R1.** Nenhuma tela chama `fetch` ou `localStorage` direto. Só hooks de domínio.
- **R2.** Concept global não é criado nem mesclado automaticamente com confiança baixa. Vira `provisional` e vai para aprovação.
- **R3.** `provisional` não participa da reutilização global entre workspaces.
- **R4.** Matching liga direto **somente** quando passa do limiar **e** o concept encontrado já é `confirmed`.
- **R5.** Toda saída de IA passa por normalização determinística em `lib/core` depois do Zod e antes de virar proposta ou gravação.
- **R6.** Nenhuma **tarefa pesada** de IA roda dentro da requisição HTTP. Ações pequenas e rápidas podem ser síncronas.
- **R7.** A quebra do `App.tsx` é refatoração mecânica isolada, verificada antes de qualquer adaptação funcional.
- **R8.** Nenhuma tela nova introduz cor, raio, fonte, sombra ou espaçamento fora dos tokens existentes.

---

## 3. Arquitetura

### 3.1 Estrutura do monorepo

```
artifacts/
  kalibra/       frontend existente, preservado
  api-server/    Express 5 (hoje só /healthz)
  worker/        NOVO — consome a fila de jobs
lib/
  db/            Drizzle + Postgres (schema hoje vazio)
  api-spec/      OpenAPI → gera api-zod e api-client-react
  api-zod/       gerado
  api-client-react/ gerado (hooks React Query + customFetch)
  core/          NOVO — regras puras, sem I/O
  ai/            NOVO — prompts, Claude API, schemas Zod de saída
```

### 3.2 `lib/core` — o que torna a Abordagem A viável

FSRS, deduplicação, geração de plano, priorização, normalização de saída de IA e classificação de erro são funções puras. Tanto o adaptador local quanto o servidor importam as mesmas funções. Na Fase 1 o "mock" é apenas a persistência: o FSRS que roda sobre `localStorage` é o mesmo que rodará sobre Postgres. Quando o flag vira, o comportamento não muda — só o lugar onde o dado mora.

### 3.3 Caminho de requisição

```
navegador → /api/* → Express
                     ├─ Clerk autentica (userId)
                     ├─ Zod valida entrada
                     ├─ service (regras + lib/core)
                     └─ Drizzle → Postgres
```

Tarefas pesadas de IA nunca acontecem na requisição. O endpoint grava uma linha em `job`, devolve `202 { job_id }`, e o worker executa. O frontend acompanha por polling do status.

`job.progress` é jsonb com as quatro etapas nomeadas que o componente `EditalUploadProgress` já desenha, e `job.error_kind` é o enum dos quatro erros do PD-07 (`scanned`, `corrupted`, `short`, `structure`). O componente ganha dado real sem mudar de forma.

### 3.4 Infraestrutura

Docker Compose com cinco serviços:

| Serviço | Papel |
|---|---|
| `postgres` | banco |
| `minio` | storage S3-compatível para PDFs e anexos |
| `api` | Express, porta interna |
| `worker` | consome `job`, executa IA e pesquisa |
| `caddy` | TLS, serve o build estático do Vite, proxy de `/api` |

O adaptador de storage nasce falando S3, rodando contra MinIO local. Trocar por S3 real depois não toca no domínio.

### 3.5 Fronteira de segredos

**Nenhuma chave de modelo, token de bot ou credencial de storage existe no frontend.** O navegador conhece apenas a API do Kalibra e a chave publicável do Clerk. Chamadas à Claude API partem exclusivamente do `api-server` e do `worker`.

Todo segredo vive em `.env` (fora do versionamento) ou em secret manager do VPS. Segredo nunca é colado em chat, commit, spec, plano de implementação ou mensagem de erro. `.env.example` documenta os nomes das variáveis, jamais os valores.

Variáveis esperadas: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `HERMES_INBOUND_TOKEN`.

### 3.6 Autenticação

Clerk permanece dos dois lados — já configurado no front e `clerkMiddleware` já presente no `api-server`. `VITE_CLERK_PROXY_URL` é preservado. Todo dado é escopado por `user_id`. Nada é público ou compartilhável na V1.

---

## 4. Modelo de domínio

### 4.1 A espinha: concept global

```
concept                     (global por usuário)
  id, canonical_name, slug, parent_id, kind, aliases[]
  status: 'confirmed' | 'provisional'
        ▲
syllabus_item               (escopado ao workspace)
  id, workspace_id, concept_id, parent_item_id
  source_label      nome literal como veio no edital
  source_excerpt    trecho que justifica a extração
  page, confidence, uncertain
        ▲
syllabus_item_cargo         (N:N — onde mora a deduplicação)
  syllabus_item_id, cargo_id, weight, question_count
```

**A deduplicação é a cardinalidade da tabela de ligação, não um algoritmo que apaga dados.** Um `syllabus_item` com duas linhas em `syllabus_item_cargo` é conteúdo comum aos dois cargos; com uma linha, é específico. A lista consolidada é `syllabus_item` sem `DISTINCT`. O rótulo "comum aos 2 cargos" sai de `count(*)`. Filtrar por cargo é filtrar o join.

Consequências:

- **Peso e quantidade de questões ficam na ligação**, porque o mesmo conteúdo pode valer 25% num cargo e 30% no outro. O diagnóstico consolidado soma questões por item sem duplicar o item.
- **Correção de deduplicação errada** é adicionar ou remover uma linha da N:N, ou reapontar o `concept_id`. Nada foi destruído na extração.
- **Renomeado ≠ removido + adicionado** (PD-08): o edital v2 traz "Emprego do acento indicativo de crase", o matcher liga ao mesmo concept de "Crase" por alias, e o diff mostra renomeação preservando o histórico de estudo.

### 4.2 Reutilização entre workspaces

`note` e `review_item` apontam para `concept_id`, nunca para `syllabus_item_id`. Uma nota escrita num workspace aparece em todo workspace que mapeie aquele concept — sem cópia e sem sincronização.

Concepts `provisional` **não participam** dessa reutilização (R3). Só viram `confirmed` pela fila de aprovação.

### 4.3 Estado FSRS

```
review_item    id, user_id, kind ('active_recall'|'question'|'topic'), concept_id, ref_id
fsrs_state     1:1 com review_item — GLOBAL
               difficulty, stability, reps, lapses, due_at, last_review_at
review_event   id, review_item_id, workspace_id, session_id, rating,
               elapsed_ms, reviewed_at, state_before, state_after
```

Estado global por item reutilizável; eventos carregam o workspace e a sessão onde ocorreram.

Flashcard **não** é um `kind` de `review_item` — ele vai para o Anki.

### 4.4 Documentos e extração

```
source_document   id, workspace_id, kind ('edital'|'prova_antiga'|'material'),
                  storage_key, mime, filename, text_extracted, word_count, hash, uploaded_at
edital_extraction id, workspace_id, source_document_id, version, status,
                  raw_output jsonb, model, created_at, approved_at
```

A extração produz **proposta**. `syllabus_item` só nasce na aprovação — PD-06 ("enquanto não confirmar, nada é gravado") vira invariante de banco.

### 4.5 Prática

```
question         id, user_id, workspace_id?, concept_id, banca_id?, exam_year?, cargo?,
                 stem, type ('mc'|'ce'|'discursiva'|'numerica'), options jsonb, correct,
                 explanation, origin ('real'|'ai'|'manual'), source_ref, pattern_tags[],
                 difficulty_est, approval_status
question_attempt id, user_id, question_id, workspace_id, session_id?, exam_id?,
                 selected, correct, confidence?, elapsed_ms, answered_at
```

Questão real de prova antiga nasce **global por banca + concept** (reutilizável entre workspaces da mesma banca). Questão gerada por IA para um workspace fica escopada a ele.

**Política de confiança:** obrigatória em `exam` (diagnóstico e simulado), configurável em treino rápido via `user_preferences`, ausente na revisão ativa — que já tem autoavaliação de recuperação. O campo é nulável.

### 4.6 Provas

```
exam           id, workspace_id, kind ('diagnostico'|'simulado'), blueprint jsonb,
               duration_s, status ('pending'|'in_progress'|'paused'|'finished'),
               started_at, accumulated_pause_s, deadline_at, finished_at
exam_question  exam_id, question_id, position, flagged
```

O cronômetro resiste a fechar a aba porque o tempo restante é derivado de `started_at + accumulated_pause_s` contra o relógio do servidor — nunca um contador em memória.

`blueprint` guarda a distribuição consolidada calculada pela deduplicação (ex.: 10 português, 10 matemática, 20 legislação, 20 tecnologia para dois cargos).

### 4.7 Sessões

```
study_session  id, workspace_id, status ('planned'|'running'|'partial'|'done'),
               planned_at, started_at, ended_at, source ('plan'|'ad_hoc')
session_block  session_id, position, kind ('fsrs'|'questoes'|'estudo'|'notas'|
               'simulado'|'revisao_ativa'|'pesquisa'), target_ref, planned_minutes,
               status ('pending'|'done'|'skipped'|'removed'), skipped_reason?
```

Bloco ignorado grava `skipped` e **não altera score nenhum**. Sessão interrompida fica `partial` e só o que foi feito entra no recálculo.

### 4.8 Revisão ativa

```
active_recall_attempt  id, user_id, workspace_id, concept_id, written_text,
                       submitted_at, feedback jsonb, self_rating, review_event_id
```

`feedback` estrutura: acertou / errou / faltou / conceitos incompletos / confusões / fontes citadas / próximo passo. O histórico das respostas escritas é esta tabela.

### 4.9 Erros

```
error_log     id, user_id, workspace_id, concept_id,
              origin ('question'|'exam'|'active_recall'|'note'|'manual'), ref_id,
              classification, severity, ai_explanation, correction_plan,
              status ('aberto'|'em revisão'|'resolvido'), created_at, resolved_at
error_group   id, user_id, label, rationale, approval_status
error_group_member  error_group_id, error_log_id
```

Classificações: falta de conhecimento, interpretação, atenção, tempo, chute, crença errada, lacuna conceitual, procedimento, confusão normativa, outro.

### 4.10 Fila de aprovação

```
approval_item  id, user_id, workspace_id?, type, status ('pendente'|'revisando'|
               'aprovado'|'rejeitado'), payload_before jsonb, payload_after jsonb,
               source_ref, confidence, rationale, created_at, decided_at, reason
```

Tipos: `edital_structure`, `question`, `flashcard`, `note_correction`, `error_group`, `plan`, `priority`, `pattern_report`, `source`, `concept_merge`.

Um componente de diff serve os dez tipos. Aprovação em lote é permitida por tipo; motivo de rejeição é opcional. Rejeitar arquiva com o motivo, não apaga.

### 4.11 Plano

```
study_plan  id, workspace_id, kind ('quinzenal'), starts_on, ends_on,
            status ('proposto'|'aprovado'|'substituido'), rationale jsonb, generated_from
plan_item   plan_id, date, concept_id?, kind, planned_minutes, rationale jsonb, status
```

`plan_item.rationale` guarda os **sinais**, não uma frase pronta:

```json
{"peso_edital": 50, "erros_recentes": 3, "erro_com_conviccao": true,
 "fsrs_vencidas": 1, "padrao_banca": "cobra literalidade", "acerto_atual": 0.39}
```

A tela monta a explicação a partir dos sinais, então a justificativa nunca descola do cálculo.

### 4.12 Flashcards e Anki

```
flashcard     id, user_id, concept_id, front, back, note_type ('basic'|'reversed'|'cloze'),
              deck, tags[], origin ('note'|'error'|'active_recall'|'question'|'edital'),
              source_ref, export_batch_id, exported_at,
              status ('rascunho'|'aprovado'|'rejeitado'|'exportado')
export_batch  id, user_id, format ('csv'|'tsv'|'apkg'), file_key, card_count, created_at
```

**Um campo de estado só, não dois.** `status` cobre o ciclo inteiro: nasce `rascunho`, a fila de aprovação o move para `aprovado` ou `rejeitado`, e a exportação para `exportado`. Os três estados que a aba de cards já exibe hoje — *rascunho · aprovado · exportado* — são exatamente esse campo, sem tocar no componente. O `approval_item` correspondente guarda o histórico da decisão; o flashcard guarda só onde está.

### 4.13 Inteligência

```
source                id, user_id, url, title, kind ('oficial'|'academica'|'governamental'|
                      'educacional'|'complementar'), excerpt, confidence, collected_at,
                      license_note, status ('candidate'|'approved'|'rejected'), reject_reason
source_concept        source_id, concept_id            (N:N)
research_job          id, workspace_id, scope[], prompt, status, authorized_at,
                      executed_via ('hermes'|'internal'), result jsonb, decided_at
exam_pattern_report   id, banca_id, workspace_id?, scope jsonb, summary, patterns jsonb,
                      example_question_ids[], risks, sources, approval_status
banca                 id, name, slug, aliases[]
```

Uma tabela de fonte com `status`, não uma `trusted_source` separada: duas tabelas duplicariam linhas e perderiam o rastro de por que a fonte foi aprovada. Fonte aprovada é uma view filtrada, e é ela que sustenta validação de nota, geração de questão, correção de revisão ativa e explicação de erro.

`exam_pattern_report.approval_status` é um portão: o relatório **só passa a influenciar** geração de questões, simulados e plano depois de aprovado.

### 4.14 Workspace, notas e suporte

```
workspace          id, user_id, slug, title, banca_id, institution, type, exam_date, status
cargo              id, workspace_id, name, exam_date, period, level
availability       workspace_id, weekday, minutes, max_session_minutes
note               id, user_id, concept_id?, folder_id, title, markdown, updated_at
note_version       id, note_id, markdown, created_at, reason
attachment         id, user_id, workspace_id?, note_id?, storage_key, mime, filename
notification       id, user_id, workspace_id?, type, payload, channel ('telegram'|'in_app'),
                   scheduled_for, sent_at, read_at
user_preferences   user_id, default_availability jsonb, quiet_hours, telegram_chat_id,
                   channels, confidence_in_quick_practice
job                id, user_id, type, payload jsonb, status ('queued'|'running'|'done'|'error'),
                   attempts, progress jsonb, error_kind, result_ref, created_at
```

Estados de `workspace`: `sem_edital`, `aguardando_upload`, `extraindo_edital`, `aguardando_revisao_edital`, `diagnostico_pendente`, `diagnostico_em_andamento`, `plano_quinzenal_pendente`, `estudando`, `erro`.

**Regra técnica:** Markdown serve para conteúdo humano. Métricas, tentativas, FSRS, erros, sessões, aprovações e recomendações ficam estruturados em tabelas.

---

## 5. Preservação do frontend

### 5.1 O contrato

```
src/domain/
  config.ts        { workspaces:'api', syllabus:'api', notes:'local', ... }
  useWorkspaces · useSyllabus · useExam · useSession · useReviewQueue
  useNotes · useErrors · useApprovals · usePlan · useFlashcards
  useResearch · usePatterns · useSources · useNotifications
  adapters/local/  localStorage + lib/core        (Fase 1)
  adapters/api/    hooks Orval                    (Fase 3)
```

`store/workspaces.ts` vira `adapters/local/workspaces.ts` sem alteração de código — só muda de pasta.

Os adaptadores locais gravam **no formato que o backend vai usar**, para que a migração da Fase 3 seja transporte e não tradução.

### 5.2 Veredito por arquivo

**Preservados sem alteração:** `pages/Home.tsx`, `components/ui/*` (58 componentes), `error-boundary`, `QuickPracticeRegistro`, `EditalUploadProgress` (forma), `Study`, `Dissertativa`, `Summary`, `Flashcards`, e todas as classes `k-*`.

**Adaptados — mesma estrutura, campos novos:**

| Arquivo | Mudança |
|---|---|
| `Portal.tsx` | status do workspace, D− por cargo, menu de ações |
| `NovoWorkspace.tsx` | multi-cargo, disponibilidade semanal, edital opcional, **limite de upload 5 MB → 20 MB** (validação em `handleFileChange` e o texto "Aceita PDF, DOCX ou TXT (Max 5MB)" na área de arraste) |
| `Shell` (App.tsx) | sidebar agrupada, badges reais |
| `Dashboard` | dados reais |
| `Edital` | lista vem de `syllabus_item`, filtro por cargo |
| `EditalRevisar.tsx` | pesos, trecho-fonte, incertezas |
| `Diagnostico.tsx` | timer do servidor, pausa e retomada |
| `Questions` | política de confiança por fluxo |
| `Review` | vira Revisão Ativa com feedback de IA |
| `Notes` | editor Markdown estilo Obsidian |
| `Errors` | dados reais |

**`Recomendações` se desdobra:** calendário e blocos vão para `/plano` (levando `StudyCalendar` e as classes `k-plan-*` inteiros); a aprovação vai para `/aprovacoes`. A recomendação deixa de ser tela e vira o `rationale` exibido no plano e no dashboard.

### 5.3 Navegação

Sidebar agrupada em **cinco seções temáticas**, com rótulos no estilo `k-eyebrow` já usado em "navegação":

```
navegação      Visão geral · Plano
conteúdo       Edital · Notas · Fontes
prática        Sessões · Questões · Simulados · Diagnóstico
revisão        Revisão ativa · Revisões FSRS · Caderno de erros
inteligência   Pesquisa técnica · Padrões da prova · Aprovações
```

`/estudo` sai da sidebar e passa a ser destino: aberto por um bloco de sessão ou clicando num tópico do edital.

### 5.4 Design system

Preservar: Space Grotesk e DM Mono; verde-limão `#d5f35b` (dark) e `#6b8d00` (light); coral `#ff907d` / `#c94f45` para risco; cantos de 3–4px; cards escuros; tipografia condensada; sidebar fixa; header limpo.

**Dark é o tema padrão.** O `App.tsx` hoje inicializa em `light` quando não há preferência salva; isso passa a ser `dark`. O tema claro continua existindo e funcionando, mas a identidade é validada primeiro no dark.

**Como toda tela nova nasce parecendo original:**

| Preciso de | Reuso |
|---|---|
| Cabeçalho de página | `k-eyebrow` + `h2 text-[27px] font-semibold tracking-[-.05em]` + `p text-[12px]` |
| Números de topo | componente `Metric` existente |
| Lista com filtros | bloco de busca + selects + contador de `Errors` |
| Tabela | `hidden md:grid` uppercase `tracking-[.1em]` + `k-table-row` |
| Item de agenda | `k-plan-item` + `k-plan-focus/review/quiet` + `k-plan-kind` |
| Escolha entre opções | `k-option` / `-selected` / `-correct` / `-wrong` |
| Estado / etiqueta | `k-chip` / `k-chip-active` |
| Painel de contexto | `aside` com `k-card` + `k-card-soft` para a dica |
| Vazio | ícone + título 13px + subtítulo 11px, como em `Errors` |
| Entrada da tela | `k-page-enter` + `k-stagger` |

Se algo não tem padrão, compor a partir de dois existentes antes de inventar um terceiro.

---

## 6. Telas novas

Oito rotas, todas validadas em mockup navegável com os tokens reais (`docs/superpowers/specs/assets/kalibra-telas-novas-v2.html`).

| Rota | Conteúdo |
|---|---|
| `/plano` | plano quinzenal aguardando aprovação, `k-plan-grid` semanal, tabela de sinais com chips tipados |
| `/sessoes` | composição de blocos reordenáveis, início de sessão, relatório em `/sessoes/:id/relatorio` |
| `/revisoes` | fila FSRS com previsão de carga por dia contra disponibilidade |
| `/simulados` | cards de simulado com metadados compactos; retomada de simulado pausado |
| `/pesquisa` | escopos selecionáveis, job que será enviado, autorização explícita, histórico |
| `/padroes` | relatório da banca com banner de "não influencia até aprovar" |
| `/fontes` | biblioteca com status, confiança, ações por linha |
| `/aprovacoes` | fila única, filtros por tipo, itens colapsáveis, diff antes/depois |

### 6.1 Regras visuais fixadas nos mockups

- **Chips de sinal tipados por família**, usando acentos que já existiam: peso do edital em verde-limão (`k-chip-active`), erro e confiança em coral (`#c94f45` / `#ff907d`), FSRS e retenção em teal (`#2b9a9f` / `#64d4d5`, já usado em `k-plan-review`), padrão da banca em âmbar (`#b76b21` / `#ffb28a`, já usado na severidade "alta" dos Erros), contexto em `k-chip` neutro. Legenda visível acima da tabela.
- **Coral significa "não cabe" ou "está errado", nunca "é o maior".** Na previsão de carga do `/revisoes`, a barra só fica coral quando os minutos de revisão do dia excedem a disponibilidade daquele dia; o pico da semana que ainda cabe fica em teal.
- **Fundo de alerta é para alerta.** Pegadinhas em `/padroes` usam `k-card-soft` com filete coral de 2px à esquerda e contagem em coral, não fundo vermelho permanente.
- **Seletores múltiplos são `k-option`, não formulário.** Linha única, `✓` em mono quando selecionada, sem checkbox nativo.
- **Itens densos colapsam.** `/aprovacoes` tem expandir/recolher por item, "recolher todos" e aprovação em lote.
- **Tabelas de consulta têm ação.** `/fontes` oferece Abrir / Revisar discretos por linha, com mais peso onde há decisão pendente.
- **A barra superior do mockup não existe no produto.** É preview de desenvolvimento; a navegação real é só a sidebar.

---

## 7. Pipeline de IA

| Tarefa | Execução | Saída | Destino |
|---|---|---|---|
| Extração de edital | job | cargos, disciplinas, tópicos, pesos, nº de questões, formato, duração, incertezas — cada um com `source_excerpt` | proposta → `/edital/revisar` |
| Matching de concept | dentro da extração | `concept_id` + score | liga direto só se passar do limiar **e** o concept for `confirmed`; senão `provisional` + fila |
| Geração de questões | job | questão, gabarito, explicação, `pattern_tags`, fonte | fila — exceto diagnóstico inicial |
| Feedback de revisão ativa | síncrono | acertou / errou / faltou / confundiu / fontes / próximo passo | tela; lacunas viram propostas |
| Classificação de erro | síncrono | classificação, severidade, explicação | `error_log` direto; agrupamento vai à fila |
| Análise de padrões | job longo | resumo, padrões por matéria e tópico, pegadinhas, exemplos, riscos | relatório → fila |
| Plano quinzenal | job | blocos + `rationale` com sinais | proposta → `/plano` |

### 7.1 Regras

1. **Saída é contrato Zod, não texto.** Cada tarefa tem schema em `lib/ai`. Resposta que não valida é re-pedida uma vez; falhando de novo, o job termina em `error` com motivo visível. Nada malformado entra no banco.
2. **Normalização determinística depois do Zod.** Toda saída passa por `lib/core` antes de virar proposta ou gravação: deduplicação, normalização, score, consistência e invariantes. Zod valida formato; `core` valida sentido.
3. **Nada sem procedência.** Todo item gerado carrega de onde veio: trecho do edital, prova e ano, fonte aprovada ou padrão da banca. A exceção do diagnóstico inicial vale só para a **aprovação**, nunca para a rastreabilidade.
4. **Contexto escalonado.** Nenhuma tarefa recebe "o banco inteiro". Extração vê o texto do edital; geração de questões vê o concept, o padrão aprovado e as fontes aprovadas; revisão ativa vê a nota do usuário, as fontes daquele concept e o texto escrito. Isso segura custo e impede mistura entre workspaces.

### 7.1.1 Por que duas tarefas são síncronas

R6 proíbe **tarefa pesada** de IA dentro da requisição. Feedback de revisão ativa e classificação de erro são as duas exceções porque reúnem três características: contexto curto e delimitado, resposta em poucos segundos, e o usuário está parado na tela esperando — transformá-las em job só acrescentaria polling sem ganho. Se qualquer uma passar a exigir contexto grande (por exemplo, comparar a resposta escrita contra o edital inteiro), ela migra para job, e o contrato de saída não muda.

### 7.2 Integração Hermes

O `research_job` gera pacote com escopo, banca, período, conceitos e critérios de fonte. Na V1 o retorno é por **importação**: o Hermes devolve JSON no formato do `research_job`, entrando por upload ou por endpoint com token. O retorno é sempre proposta — provas viram `source_document` para extração de questões; fontes viram `source` com status `candidate`. Webhook e fila automática ficam para depois, sem mudar o contrato.

### 7.3 Modelo

Claude, escolhido por tarefa em config, não espalhado no código. Extração de edital e análise de padrões usam o modelo mais capaz (documento longo, estrutura complexa); classificação de erro e matching de concept usam o mais barato.

---

## 8. Fases

Cada fase recebe seu próprio plano de implementação detalhado quando chegar a vez. Este spec define a arquitetura, o domínio e a sequência; ele não substitui o plano de execução de cada fase. O primeiro plano cobre a Fase 0 e a Fase 1.

### Fase 0 — Refatoração mecânica (nenhuma mudança visual)

1. Mover cada bloco do `App.tsx` (958 linhas) para `src/pages/` — recorte e colagem, JSX e classes idênticos
2. Criar `src/domain/` com hooks e `adapters/local/` embrulhando os mocks atuais; telas param de tocar em `localStorage`
3. Dark como tema padrão

**Saída:** `pnpm typecheck && pnpm build` passam **e** comparação visual antes/depois de todas as telas existentes confirma que o layout não mudou.

### Fase 1 — Frontend completo com adaptadores locais

Ordem fixada:

1. `lib/core` com testes (FSRS, dedup, plano, priorização, classificação)
2. workspace multi-cargo (disponibilidade, edital opcional, status)
3. edital e revisão (wizard, pesos, trechos-fonte, incertezas, dedup visível)
4. **aprovações base** — infraestrutura transversal, vem antes de quem produz itens para ela
5. diagnóstico (timer persistido, pausa e retomada, blueprint, relatório)
6. plano quinzenal
7. sessões e relatório de sessão
8. revisão ativa e fila FSRS
9. notas estilo Obsidian
10. questões e simulados
11. erros
12. pesquisa, padrões e fontes

**Saída:** produto inteiro navegável e coerente, sem backend.

### Fase 2 — Backend

Schema Drizzle completo e migrations → OpenAPI e codegen → services e rotas com Clerk → Docker Compose.

**Saída:** API tipada no ar, ainda sem frontend ligado.

### Fase 3 — Ligar módulo a módulo

Workspaces → edital/syllabus → exames → sessões → FSRS → notas → erros → aprovações. Cada módulo: escrever `adapters/api`, migrar o dado local existente, virar o flag, verificar.

**Saída:** `config.ts` sem nenhum `'local'`.

### Fase 4 — IA real

`lib/ai` + schemas + normalização em `core` → extração de edital (aposenta o `setTimeout` do `EditalUploadProgress`) → questões do diagnóstico → feedback da revisão ativa → classificação de erro e plano quinzenal.

### Fase 5 — Inteligência

`research_job` e contrato do Hermes → importação → fontes → análise de padrões → padrões alimentando geração e plano depois de aprovados.

### Fase 6 — Fechamento

Export Anki (CSV/TSV/APKG e lotes) → notificações Telegram com quiet hours → export/import JSON e Markdown → exclusão de conta e dados.

### Portão de qualidade

Em toda fase: `pnpm typecheck && pnpm build`, mais os fluxos críticos do §22 do brief como testes — criar workspace sem edital, criar com edital, multi-cargos, aprovação de estrutura extraída, diagnóstico obrigatório, pausar e retomar diagnóstico, relatório do diagnóstico, plano quinzenal pendente, criar nota Markdown, preview Markdown, revisão ativa, fila de aprovação, status de workspace.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **Qualidade da extração de edital** — editais brasileiros variam demais de formato. É o risco número um do produto | A tela de revisão existe porque a extração vai errar. O caminho manual precisa ser bom o bastante para ser usado sozinho |
| **Fase 1 é longa e termina sem persistência real** | Adaptadores locais gravam no formato do backend; a Fase 3 é transporte, não tradução |
| **Custo de IA na análise de padrões** (240 questões por rodada) | Job, cache por banca, resultado reutilizável entre workspaces da mesma banca |
| **Poluição da biblioteca global de concepts** | `provisional` + aprovação humana; provisional não participa de reutilização |
| **Deriva visual ao longo de 8 telas novas** | Regra R8, mockup aprovado como referência, e composição a partir de padrões existentes |

---

## 10. Decisões reversíveis com padrão escolhido

Não bloqueiam o início. Cada uma já tem um padrão definido; mudar depois é barato.

| Tema | Padrão adotado |
|---|---|
| Editor Markdown | CodeMirror 6 com preview lateral alternável |
| Biblioteca FSRS | `ts-fsrs` |
| Ratings da UI | Nada / Parcial / Bom / Completo (já existe na tela `Review`) |
| Rating da revisão ativa | usuário autoavalia; a IA sugere e não decide |
| Formatos de edital | PDF, DOCX, TXT e texto colado; limite de **20 MB** |
| Caderno de erros | global por usuário, com filtro por workspace, aberto no workspace atual |
| Aprovação em lote | permitida por tipo |
| Motivo de rejeição | opcional |
| Notificações | Telegram primeiro; e-mail depois da V1 |
| Responsividade | desktop-first, mobile funcional |
| Alternativas por questão | vindo do edital, 4 por padrão (PD-09) |

---

## 11. Perguntas que ainda precisam de resposta do Yuri

Estas não têm padrão seguro porque dependem de informação que só ele tem.

1. **Critérios de fonte confiável.** O brief diz que ele pretende treinar o Hermes para validar fontes. A lista atual é sugestão. Materiais de cursinho, blogs e YouTube entram como `complementar` ou ficam fora? Wikipedia é fonte inicial ou só auxiliar?
2. **Credenciais e infra.** Domínio e VPS de destino, orçamento mensal de IA, e a confirmação de quais integrações entram na V1. **Os valores em si nunca vêm por chat nem entram no repositório** — vão direto para `.env` ou secret manager, seguindo §3.5. O que preciso saber é apenas *quais* existem e quando estarão disponíveis.
3. **Contrato de retorno do Hermes.** Ele devolve JSON por upload manual ou o Kalibra expõe endpoint com token? Qual dos dois ele prefere operar na prática?
4. **Conflito entre fontes.** Quando duas fontes aprovadas discordam, o Kalibra mostra as duas, prefere a de maior autoridade, ou abre item na fila de aprovação?
5. **Prova discursiva.** A revisão ativa deve virar simulado dissertativo quando o concurso tiver questão discursiva, reaproveitando a tela `Dissertativa` que já existe?
