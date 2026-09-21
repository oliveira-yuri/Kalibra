import type { Express } from "express";
import { criarDb } from "@workspace/db";
import { criarApp } from "./criar-app";

/**
 * O wiring de PRODUÇÃO. Nada além disso.
 *
 * O corpo do Express vive em `criar-app.ts`, para que um teste possa injetar banco
 * e sessão. Aqui as dependências são as reais: o Postgres de `DATABASE_URL` e o
 * extrator do Clerk.
 *
 * **`extrairUserId` não é passado de propósito** — o padrão da fábrica já é
 * `extrairClerkUserId`, que chama `getAuth(req)`. Passar um extrator aqui seria a
 * forma de uma porta dos fundos entrar em produção, então a ausência é a garantia.
 */
const app: Express = criarApp({ db: criarDb(process.env.DATABASE_URL) });

export default app;
