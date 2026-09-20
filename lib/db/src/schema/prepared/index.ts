// Tabelas PREPARATÓRIAS. Existem no schema para que a fase que as implementar
// acrescente comportamento em vez de reestruturar a espinha de posse — acrescentar
// coluna é migração aditiva e barata; corrigir FK de escopo com dados dentro, não.
//
// Exportá-las aqui é NECESSÁRIO: o `drizzle-kit` só enxerga o que o barril exporta.
// A fronteira não é "não exportar", é "não usar": nenhum endpoint, adaptador, hook,
// serviço, tela ou teste de aplicação pode tratá-las como se a feature existisse.
// Há teste estrutural fixando isso (`preparadas.test.ts`).
export * from './question';
export * from './exam';
export * from './question-attempt';
export * from './exam-question';
export * from './diagnostic-result';
