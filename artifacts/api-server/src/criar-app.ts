import express, { type Express, type Request } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import type { Db } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { erroFinal } from "./middlewares/erro-final";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

/**
 * Quem está autenticado nesta requisição, ou `null`.
 *
 * É a única fronteira entre o Clerk e o resto do servidor. Em produção
 * `extrairClerkUserId` chama `getAuth(req)`; num teste, devolve a sessão injetada.
 * A lógica que usa o resultado — recusar sem sessão, nunca ler posse do corpo da
 * requisição — é o MESMO código nos dois casos.
 */
export type ExtratorDeUsuario = (req: Request) => string | null;

/**
 * O extrator de produção. É também o PADRÃO da fábrica, de propósito: se alguém
 * montar o app sem injetar nada, o que roda é o caminho real do Clerk — nunca um
 * extrator permissivo, nunca `undefined` interpretado como "qualquer um".
 */
export const extrairClerkUserId: ExtratorDeUsuario = (req) => getAuth(req).userId ?? null;

export type DependenciasDoApp = {
  db: Db;
  /** Só para teste. Omitir é o caminho de produção. */
  extrairUserId?: ExtratorDeUsuario;
};

/**
 * Monta o Express. `app.ts` é o wiring de produção; esta fábrica existe para que um
 * teste possa injetar banco e sessão sem que o caminho de produção mude.
 *
 * **A ordem dos middlewares é a mesma de antes e não pode ser reorganizada.** Em
 * particular, o proxy do Clerk é montado ANTES de `express.json()` — o arquivo
 * daquele middleware documenta por quê, e inverter isso quebra o proxy em produção
 * sem quebrar teste nenhum.
 */
export function criarApp({ db, extrairUserId = extrairClerkUserId }: DependenciasDoApp): Express {
  const app: Express = express();

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

  app.use(cors({ credentials: true, origin: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );

  // Disponibiliza as dependências para as rotas sem passá-las por parâmetro em
  // cada uma. `db` e `extrairUserId` ficam no app, não na requisição: são do
  // processo, não do pedido.
  app.set("db", db);
  app.set("extrairUserId", extrairUserId);

  app.use("/api", router);

  // ÚLTIMO da cadeia, de propósito: só chega aqui o que ninguém tratou. Sem ele o
  // Express responde com a página padrão, que inclui mensagem e stack completa.
  app.use(erroFinal);

  return app;
}
