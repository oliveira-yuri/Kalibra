import { describe, it, expect } from 'vitest';
import { CORE_PACKAGE } from './index';

describe('pacote core', () => {
  it('expõe sua identidade', () => {
    expect(CORE_PACKAGE).toBe('core');
  });
});
