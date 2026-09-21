/**
 * Importar este pacote não tem efeito colateral: não valida ambiente, não abre
 * conexão, não lê segredo. Quem quer só os tipos do schema — o `api-server` para
 * compilar, um teste para montar dados — paga zero por isso.
 *
 * A conexão é obtida chamando `criarDb(databaseUrl)`.
 */
export { criarDb, type Db } from './connection';
export * from './schema';
