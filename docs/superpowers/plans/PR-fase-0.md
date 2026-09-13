# Fase 0 — Refatoração mecânica do frontend e camada de domínio

Primeira fase do plano de construção da V1 do Kalibra. Ela não adiciona
funcionalidade: reestrutura o frontend existente para que as fases seguintes
possam adicionar funcionalidade sem risco, e estabelece a rede de testes que
torna esse risco mensurável.

## O que mudou

**`App.tsx`: 958 → 24 linhas.** O arquivo que continha shell, dashboard, edital,
estudo, revisão, questões, erros, recomendações, notas, rotas e configuração do
Clerk agora contém apenas os providers. Cada bloco foi movido verbatim para seu
próprio arquivo — mesmo JSX, mesmas classes, mesmo texto.

**Camada de domínio.** Nenhuma tela toca mais `localStorage`, `sessionStorage`
ou `fetch`. Tudo passa por `src/domain/`, onde cada módulo escolhe um adaptador
local ou de API via `src/domain/config.ts`. Na Fase 3, ligar o backend é virar
um flag por módulo, sem editar tela nenhuma.

**Dark como tema padrão**, com script pré-paint no `index.html` para não haver
flash branco no primeiro frame.

**Build destravado fora do Replit.** O projeto vinha configurado para
`linux-x64` apenas e não compilava em outra plataforma.

## Como verificar que nada visual mudou

A rede de segurança foi construída **antes** da primeira extração: 16 snapshots
do HTML renderizado, mais 2 testes de tema.

**Dos 20 commits desta branch, apenas 3 tocaram os snapshots** — o que os criou,
o que acrescentou 4 rotas, e o que adotou o tema dark (auditado classe a classe:
só trocas entre pares claro/escuro que já existiam). **Os 14 commits de extração
não alteraram um único byte de DOM renderizado.**

A revisão final comparou as 958 linhas originais contra o código atual, linha a
linha: as 52 que não batem são todas explicadas (imports, renames, assinaturas
que ganharam `export`). Nenhuma linha de JSX, string de classe, `data-testid` ou
texto se perdeu.

```
pnpm run typecheck   # 4 projetos
pnpm run test        # 18 testes, 0 snapshots escritos
pnpm run build       # 3 artifacts
```

## Limites conhecidos

- **A cobertura real é de 13 telas distintas, não 16.** O mock do Clerk renderiza
  só o ramo `signed-in`, então `/` redireciona para `/portal` e `Home.tsx` fica
  sem cobertura; `/sign-in` e `/sign-up` capturam apenas o wrapper de tema.
  Registrado em `docs/superpowers/plans/2026-09-12-kalibra-fase-0-verificacao.md` §5.
- **Verificação manual no navegador não foi feita** — faltou
  `VITE_CLERK_PUBLISHABLE_KEY`. Estilos computados, widgets reais do Clerk e
  comportamento interativo seguem sem conferência visual direta.
- **`BASE_PATH` tem default `/`.** Um deploy sob subcaminho (a Fase 2 põe Caddy
  na frente) precisa defini-lo explicitamente, ou os assets saem com URL de raiz.
  A exigência pertence ao pipeline de deploy, não ao default da config — o
  raciocínio está no §8 do documento de verificação.

## Para a Fase 1

`src/domain/config.ts` hoje é uma asserção, não um seletor: os guardas provam
que o valor é `'local'` e lançam para qualquer outro. Vira seletor de verdade
quando o primeiro `adapters/api/` existir. Os tipos de workspace ainda moram
dentro do adaptador local e devem subir para `src/types.ts` enquanto há só um
adaptador.

## Documentos

- Spec: `docs/superpowers/specs/2026-09-12-kalibra-design.md`
- Plano: `docs/superpowers/plans/2026-09-12-kalibra-fase-0.md`
- Verificação: `docs/superpowers/plans/2026-09-12-kalibra-fase-0-verificacao.md`
- Mockup das 8 telas da Fase 1: `docs/superpowers/specs/assets/kalibra-telas-novas-v2.html`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
