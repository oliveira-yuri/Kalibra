# Kalibra

Workspace interno de estudos para preparação de provas e concursos, com prática ativa, revisão espaçada, questões, caderno de erros e recomendações.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/kalibra/src/App.tsx` — frontend navegável e estado mockado do workspace.
- `artifacts/kalibra/src/index.css` — tokens e estilos visuais do produto.
- `artifacts/kalibra` — app React + Vite servido na raiz.

## Architecture decisions

- A primeira entrega é frontend-only, com estado local para demonstrar o ciclo completo antes do backend.
- A criação de workspace e a entrada do edital são protótipos locais; o backend real deverá substituir essa persistência e processar os documentos sem alterar o fluxo da interface.
- O produto é estruturado ao redor de prática, revisão, questões, erros e diagnóstico; notas aparecem como apoio no estudo.
- A navegação é client-side e mantém o shell do workspace fixo entre as telas.

## Product

- Dashboard do concurso SETEC Campinas com contagem regressiva, progresso, pontos fracos e próxima ação.
- Edital/checklist por matéria e tópico, estudo ativo, revisão espaçada, questões/simulado, caderno de erros e recomendações aprováveis.
- Calendário semanal abaixo das recomendações, recalculado quando um ajuste é aprovado.
- Caderno de notas em Markdown com múltiplas notas, edição, visualização e salvamento local.
- Autenticação real com cadastro e login, portal pessoal de processos seletivos e entrada em workspaces separados.
- Novo workspace coleta dados da prova e recebe o edital por PDF, DOCX, TXT ou texto colado; a página Edital permite enviar versões atualizadas.
- O workspace permite alternar cargos do mesmo concurso, preservando a rota e usando data/período específicos do cargo.
- Questões capturam confiança antes do gabarito; revisão usa recuperação escrita; Estudo inclui treino dissertativo e seleção de cards para exportação ao Anki.
- Há registro rápido de prática externa, revisão humana da estrutura extraída do edital, comparação de versões e estados explícitos de processamento.
- A prova diagnóstica possui preparação, modo foco com confiança por resposta e relatório de desempenho por seção e por confiança.

## User preferences

- Interface interna de produto; não construir landing page.
- Evitar clone do Notion, visual infantil, mascotes, gamificação exagerada e números sem sentido.

## Gotchas

- A prévia é uma aplicação de demonstração com dados locais; persistência e backend ainda não fazem parte desta entrega.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
