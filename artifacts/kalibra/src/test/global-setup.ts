import type { TestProject } from 'vitest/node';
import { subirServidorCompartilhado } from '@workspace/api-server/src/test/servidor-compartilhado';

/**
 * Sobe UM `api-server` real, sobre PGlite, para a suíte inteira do frontend.
 *
 * Roda aqui e não dentro de cada arquivo porque `globalSetup` executa em Node,
 * enquanto os testes de tela executam em jsdom — e PGlite não funciona sob jsdom.
 * Um servidor por arquivo seria impossível; um servidor para todos é o que sobra, e
 * o isolamento vem de cada arquivo usar um usuário diferente.
 *
 * A porta vai por `provide`, não por variável de ambiente: variável de ambiente
 * atravessa processos que não deveriam vê-la, e o canal do Vitest é tipado.
 */
export default async function setup({ provide }: TestProject) {
  const servidor = await subirServidorCompartilhado();
  provide('apiBaseUrl', servidor.baseUrl);
  return async () => { await servidor.encerrar(); };
}

declare module 'vitest' {
  interface ProvidedContext {
    apiBaseUrl: string;
  }
}
