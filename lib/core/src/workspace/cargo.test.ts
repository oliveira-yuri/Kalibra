import { describe, it, expect } from 'vitest';
import { defaultCargo } from './cargo';

/**
 * A cobertura que o cenário de contrato tinha, agora onde ela pertence.
 *
 * `defaultCargo` saiu da porta na Fase 5 por ser regra pura, e o cenário "o cargo
 * padrão tem a data da prova pedida" saiu do harness junto. **Não foi cobertura
 * perdida — foi cobertura movida**: o harness compara duas implementações, e esta
 * função tem uma só.
 */
describe('defaultCargo — o cargo sintético de quem não nomeou nenhum', () => {
  it('carrega a data da prova pedida', () => {
    expect(defaultCargo('2027-05-10').examDate).toBe('2027-05-10');
  });

  it('tem id e nome — um cargo sem eles não renderiza', () => {
    const cargo = defaultCargo('2027-05-10');
    expect(cargo.id).toBeTruthy();
    expect(cargo.name).toBeTruthy();
  });

  it('é estável entre chamadas — a mesma data dá o mesmo cargo', () => {
    // Regressão I3: `parseWorkspaceDraft` e a criação de workspace novo chamam
    // isto em momentos diferentes. Se o id variasse, o mesmo workspace teria
    // cargos diferentes conforme o caminho que o produziu.
    expect(defaultCargo('2027-05-10')).toEqual(defaultCargo('2027-05-10'));
  });

  it('não inventa período', () => {
    expect(defaultCargo('2027-05-10').period).toBeUndefined();
  });
});
