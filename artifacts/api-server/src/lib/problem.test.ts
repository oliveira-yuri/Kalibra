import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Valores plantados ANTES de o app subir — por isso ficam no topo do módulo, e o
 * harness é importado dinamicamente depois.
 *
 * São marcadores reconhecíveis, não credenciais: o teste procura estas strings
 * exatas em toda resposta de erro. Se um `error.message` de biblioteca trouxer a
 * string de conexão junto, ou o Express devolver a stack, uma delas aparece.
 */
const SEGREDOS = {
  DATABASE_URL: 'postgres://usuario:SENHA_PLANTADA_XYZ@host:5432/banco',
  ANTHROPIC_API_KEY: 'sk-ant-CHAVE_PLANTADA_XYZ',
  CLERK_SECRET_KEY: 'sk_test_CLERK_PLANTADA_XYZ',
} as const;

/** As agulhas que não podem aparecer em resposta nenhuma. */
const AGULHAS = [
  'SENHA_PLANTADA_XYZ',
  'CHAVE_PLANTADA_XYZ',
  'CLERK_PLANTADA_XYZ',
  ...Object.values(SEGREDOS),
];

for (const [chave, valor] of Object.entries(SEGREDOS)) {
  process.env[chave] = valor;
}

const { criarHarness } = await import('../test/harness');
type Harness = Awaited<ReturnType<typeof criarHarness>>;

let h: Harness;
beforeAll(async () => { h = await criarHarness(); });
afterAll(async () => { await h.encerrar(); });
beforeEach(async () => { await h.limpar(); h.entrarComo(null); });

/** Corpo + cabeçalhos numa string só — a varredura olha os dois. */
async function respostaInteira(r: Response): Promise<string> {
  const cabecalhos = [...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
  return `${cabecalhos}\n${await r.text()}`;
}

function semSegredos(texto: string): string[] {
  return AGULHAS.filter((agulha) => texto.includes(agulha));
}

describe('problem+json é uniforme', () => {
  it('401 — sem sessão', async () => {
    const r = await h.pedir('/api/me');
    expect(r.status).toBe(401);
    expect(r.headers.get('content-type')).toContain('application/problem+json');
    const corpo = (await r.json()) as Record<string, unknown>;
    expect(corpo).toMatchObject({ status: 401, code: 'sessao_ausente' });
    expect(corpo.type).toBe('https://kalibra.app/problemas/sessao_ausente');
    expect(typeof corpo.title).toBe('string');
  });

  it('404 — recurso de outro usuário', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    const r = await h.pedir('/api/users/11111111-1111-1111-1111-111111111111');
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toContain('application/problem+json');
    const corpo = (await r.json()) as Record<string, unknown>;
    expect(corpo).toMatchObject({ status: 404, code: 'recurso_nao_encontrado' });
  });

  it('500 — erro interno PROVOCADO DE VERDADE, não simulado', async () => {
    h.entrarComo({ clerkUserId: 'clerk_a' });
    // `id` não é um UUID: o Postgres lança "invalid input syntax for type uuid",
    // com o SQL dentro da mensagem. É um erro real do driver, subindo pela rota —
    // exatamente a forma como detalhe interno vaza quando ninguém trata.
    const r = await h.pedir('/api/users/nao-e-um-uuid');

    expect(r.status).toBe(500);
    expect(r.headers.get('content-type')).toContain('application/problem+json');
    const corpo = (await r.json()) as Record<string, unknown>;
    expect(corpo).toMatchObject({ status: 500, code: 'erro_interno' });

    // O corpo é FIXO: nada derivado de `error.message`.
    const texto = JSON.stringify(corpo);
    expect(texto).not.toMatch(/invalid input syntax/i);
    expect(texto).not.toMatch(/\bselect\b/i);
    expect(texto).not.toMatch(/at .*\.ts:\d+/);
    expect(texto).not.toMatch(/node_modules/);
  });
});

describe('nenhum segredo vaza em resposta de erro', () => {
  /**
   * Varrer a resposta, e não revisar o código, é o ponto.
   *
   * Revisão de código acha o vazamento que alguém escreveu de propósito. A
   * varredura acha o que um `error.message` de biblioteca trouxe junto sem
   * ninguém notar — que é como isso acontece de verdade.
   */
  const CASOS: ReadonlyArray<[string, string, boolean]> = [
    ['401 sem sessão', '/api/me', false],
    ['404 recurso de outro', '/api/users/11111111-1111-1111-1111-111111111111', true],
    ['500 provocado', '/api/users/nao-e-um-uuid', true],
    ['404 de rota inexistente', '/api/rota-que-nao-existe', true],
  ];

  it.each(CASOS)('%s: corpo e cabeçalhos limpos', async (_nome, caminho, autenticado) => {
    if (autenticado) h.entrarComo({ clerkUserId: 'clerk_a' });
    const r = await h.pedir(caminho);
    const achados = semSegredos(await respostaInteira(r));
    expect(achados).toEqual([]);
  });

  it('a varredura funciona — se a resposta trouxesse um segredo, ela acusaria', () => {
    // Sem isto, `semSegredos` poderia estar sempre devolvendo vazio por erro de
    // construção, e os quatro testes acima passariam sem verificar nada.
    const respostaEnvenenada = `content-type: application/problem+json\n{"detail":"${SEGREDOS.DATABASE_URL}"}`;
    expect(semSegredos(respostaEnvenenada).length).toBeGreaterThan(0);
  });
});
