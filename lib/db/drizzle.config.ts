import { defineConfig } from "drizzle-kit";
import path from "path";

/**
 * `generate` produz SQL a partir do schema e **não conecta em nada** — exigir
 * `DATABASE_URL` para gerar uma migration obrigaria a ter um segredo à mão para uma
 * operação puramente local, inclusive em CI e em máquina de desenvolvimento sem
 * banco.
 *
 * A regra é explícita: `dbCredentials` entra apenas quando `DATABASE_URL` existe, e
 * o campo é omitido quando não existe. Nada é detectado a partir do comando.
 *
 * Isto não afrouxa nada em tempo de conexão: `push` e `studio`, que precisam de um
 * banco de verdade, continuam falhando sem a variável — com a mensagem do próprio
 * Drizzle sobre credencial ausente.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
});
