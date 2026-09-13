# Fase 1A — lib/core e workspace multi-cargo

> **Base: `fase-0-refatoracao`**, não `main`. Esta fase depende da Fase 0, cujo PR
> ainda está aberto. Mergear a Fase 0 primeiro; esta rebaseia limpo em seguida.

Primeira fase que adiciona funcionalidade. Cria o pacote de regras puras do
projeto e expande o workspace para múltiplos cargos, disponibilidade semanal e
edital opcional — sem crescer o design system.

## O que mudou

**`lib/core` — 57 testes, zero I/O.** Um pacote de funções puras: entram dados,
saem dados. Nenhuma leitura de relógio, nenhum acesso a storage, nenhuma
dependência de estado ambiente — verificado por varredura no pacote inteiro. É
essa propriedade que permite ao servidor importá-lo sem alteração na Fase 2.

Contém: a máquina de estados do workspace (9 estados, com o diagnóstico inicial
obrigatório *provadamente* impossível de pular), disponibilidade semanal com
validação, geração de slug determinística, aritmética de datas por cargo, e o
agendamento FSRS sobre `ts-fsrs`.

**Workspace expandido, com migração defensiva — 64 testes no frontend.** O
formato salvo ganhou status real, cargos obrigatórios, disponibilidade e
`hasEdital`. Registros já salvos no navegador do usuário são migrados na
leitura.

**Novo Workspace** agora coleta múltiplos cargos e disponibilidade semanal, e
permite criar um workspace sem edital. Limite de upload alinhado em 20 MB nas
duas telas que o aplicam.

**Card do Portal** mostra o status real, a contagem regressiva do cargo
selecionado, o nome do cargo quando há mais de um, e um menu de ações que
funciona.

## Três bugs que a revisão pegou e os testes não pegariam

**1. A migração destruía todos os workspaces do usuário.** A função lançava com
`cargos: [null]`. Como `getWorkspaces` usa `.map`, um único registro corrompido
abortava o array inteiro, caía no `catch` externo e devolvia os dados de
demonstração — substituindo todo o histórico real por fixtures, sem cópia no
servidor para restaurar. Corrigido em duas camadas: validação dos elementos, e
isolamento por registro dentro do `map`.

**2. A sidebar mostrava a data errada — desde antes desta fase.**
`new Date('2026-06-01')` é meia-noite **UTC**, que em UTC−3 cai no dia 31 de
maio; o `setHours(0,0,0,0)` fixava esse dia errado. A prova andava um dia para
trás. Portal e sidebar agora compartilham uma implementação, verificada contra
contagem de calendário real.

**3. O FSRS corrompia o próprio estado em silêncio.** Sem `enable_short_term:
false`, o card entra num sub-estado *Learning* que o formato persistido não
registra; o round-trip zerava o ganho de estabilidade e deixava de contar
lapsos. O flag está documentado como decisão de produto — com short-term ligado,
três dos quatro botões de revisão mostrariam "0 dias" — e um teste falha
imediatamente se alguém revertê-lo.

## Verificação

```
pnpm run typecheck   # 5 projetos
pnpm run test        # 122 testes (58 lib/core + 64 frontend)
pnpm run build       # 3 artifacts
```

A suíte foi executada em `TZ=UTC`, `America/Sao_Paulo` e `Pacific/Kiritimati`
(UTC+14), com o mesmo resultado e zero snapshots reescritos — o relógio de teste
é congelado por construtor local, então a contagem regressiva não depende do fuso
de quem roda.

Design system: `index.css` **não foi tocado**. Nenhuma cor, raio, fonte, sombra
ou tipo novo. Os três componentes novos compõem só de classes `k-*` existentes,
e o menu de ações é cópia literal do padrão que `EditalRevisar` já usava.

## Limites conhecidos

- **Verificação manual no navegador não foi feita** — faltou
  `VITE_CLERK_PUBLISHABLE_KEY`. Estilos computados, widgets reais do Clerk e o
  menu de ações seguem sem conferência visual direta.
- **Cobertura é dominada por snapshot** para UI: o menu de ações e os tons de
  erro do chip de status não têm teste de interação.

## Para a próxima fase

- A máquina de estados **modela um fluxo que o app não segue**: a criação de
  workspace salta direto para `aguardando_revisao_edital`, e `TRANSITIONS` não
  admite essa aresta. No dia em que `canTransition` for aplicado, criar
  workspace passa a ser rejeitado. Reconciliar antes de ligá-la.
- `hasEdital` e `status` são duas representações do mesmo fato e já podem
  discordar. Eleger uma como canônica antes que apareça um terceiro escritor.
- `lib/core` carrega texto de interface em português. Quando a Fase 2 o importar
  no servidor, essas strings viram texto de erro de API. Decidir códigos vs.
  strings antes.
- Se a Fase 2 mudar a chave de storage de array puro para um envelope
  versionado, `Array.isArray` falha e o usuário vê dados de demonstração. Versionar
  a chave ou tratar os dois formatos no mesmo commit.

## Documentos

- Spec: `docs/superpowers/specs/2026-09-12-kalibra-design.md`
- Plano: `docs/superpowers/plans/2026-09-13-kalibra-fase-1a.md`
- Verificação: `docs/superpowers/plans/2026-09-13-kalibra-fase-1a-verificacao.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
