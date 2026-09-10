---
name: Clerk e caminhos-base
description: Regras de integração do Clerk gerenciado com proxy de produção e navegação em workspaces aninhados.
---

Mantenha `VITE_CLERK_PROXY_URL` passado incondicionalmente ao `ClerkProvider`: ele fica vazio no desenvolvimento e é preenchido automaticamente pelo sistema de produção da Replit.

**Why:** Um fallback ou condicional por ambiente parece útil, mas quebra o contrato do proxy gerenciado. Além disso, links que escapam do roteador de workspace precisam carregar explicitamente o caminho-base do artefato.

**How to apply:** Ao criar novos fluxos autenticados ou workspaces aninhados, preserve o proxy canônico e faça retornos ao portal/logout apontarem para a origem mais o `BASE_URL`.