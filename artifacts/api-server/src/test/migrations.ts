import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Sobe a árvore procurando `lib/db/migrations`.
 *
 * Era um caminho relativo fixo, e quebrou assim que o harness passou a ser
 * importado de FORA deste pacote: o driver de contrato o alcança por
 * `@workspace/api-server`, que o pnpm resolve por link simbólico, e aí subir
 * quatro níveis chega a `node_modules/@workspace/` em vez da raiz. Procurar é imune
 * a como o módulo foi alcançado.
 */
export function acharMigrations(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    const candidato = join(dir, 'lib', 'db', 'migrations');
    if (existsSync(join(candidato, 'meta', '_journal.json'))) return candidato;
    const acima = dirname(dir);
    if (acima === dir) break;
    dir = acima;
  }
  throw new Error('não encontrei lib/db/migrations subindo a partir do harness');
}
