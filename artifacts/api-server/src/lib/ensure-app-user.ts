import { eq } from 'drizzle-orm';
import { appUser, type Db } from '@workspace/db';

export type ClerkClaims = {
  clerkUserId: string;
  email?: string | null;
  name?: string | null;
};

/**
 * Garante que existe uma linha em `app_user` para esta identidade do Clerk, e
 * devolve o `id` interno.
 *
 * **Idempotente por construção, não por ordem de execução.** Duas requisições
 * simultâneas do mesmo usuário — abrir duas abas ao mesmo tempo é suficiente —
 * chegam aqui juntas. Um `select` seguido de `insert` teria uma janela entre os
 * dois em que ambas concluem "não existe" e ambas inserem; a segunda quebraria.
 *
 * `onConflictDoUpdate` sobre `clerk_user_id` fecha essa janela no banco. A
 * unicidade que a Fase 2 criou é o que torna isso verdade — sem ela, o `on
 * conflict` não teria em que se apoiar.
 *
 * O Clerk continua dono da identidade: `email` e `name` são conveniência de
 * leitura, atualizados quando chegam, e nunca fonte da verdade.
 */
export async function ensureAppUser(db: Db, claims: ClerkClaims): Promise<string> {
  const [linha] = await db
    .insert(appUser)
    .values({
      clerkUserId: claims.clerkUserId,
      email: claims.email ?? null,
      name: claims.name ?? null,
    })
    .onConflictDoUpdate({
      target: appUser.clerkUserId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: appUser.id });

  if (linha) return linha.id;

  // Caminho defensivo: se o `returning` vier vazio por qualquer motivo, a linha
  // existe de todo modo — buscá-la é melhor que devolver um id inventado.
  const [existente] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.clerkUserId, claims.clerkUserId));
  return existente.id;
}
