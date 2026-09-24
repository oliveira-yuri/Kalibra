import { vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// O setup roda para TODO arquivo do pacote, inclusive os poucos marcados
// `@vitest-environment node` — o contrato contra a API sobe um servidor de
// verdade e PGlite não funciona sob jsdom. Sem esta guarda, aqueles arquivos
// morriam em `window is not defined` antes de rodar qualquer teste.
const temDom = typeof window !== 'undefined';

// Radix e o hook use-mobile leem matchMedia; jsdom não implementa.
if (temDom && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// Radix usa ResizeObserver em popovers e scroll areas.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Silencia o aviso de act() do React 19 em renderizações síncronas de snapshot.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.stubGlobal('scrollTo', () => {});
