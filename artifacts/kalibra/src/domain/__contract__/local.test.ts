import { rodarContrato } from './runner';
import { criarDriverLocal } from './local-driver';

/**
 * O contrato contra o adaptador local.
 *
 * Este arquivo é curto de propósito: tudo que ele sabe é qual driver usar. Os
 * cenários vivem em `cenarios.ts` e não conhecem adaptador nenhum — é o que
 * permitirá que `api.test.ts`, na Fase 5, seja igualmente curto e rode
 * exatamente os mesmos cenários.
 */
rodarContrato('adaptador local', criarDriverLocal);
