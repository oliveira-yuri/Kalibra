import { rodarContrato } from './runner';
import { criarDriverLocal } from './local-driver';
import type { Driver, MundoDeTeste } from './driver';

/**
 * Os MESMOS cenários, contra um driver em que toda operação atravessa um macrotask
 * antes de executar e outro antes de responder.
 *
 * **O que isto mostra:** os 20 cenários passam sob latência. Nenhum depende de a
 * resposta chegar na hora.
 *
 * **O que isto NÃO mostra, e é preciso dizer:** não consegui construir um cenário
 * verde no driver normal e vermelho neste. Duas tentativas — ler sem `await`, e
 * disparar duas mutações concorrentes — ficaram vermelhas no normal e VERDES aqui,
 * ou seja, este driver é mais permissivo, não mais severo.
 *
 * A razão é estrutural, e vale mais que o próprio arquivo: **o `Driver` é
 * uniformemente assíncrono, e o driver local embrulha cada mutação em
 * `await act(async …)`.** Isso já impõe uma fronteira de microtask a toda
 * operação. Depender de sincronicidade não é uma coisa que um cenário consiga
 * expressar — a interface não deixa. O atraso extra daqui não abre nenhuma fresta
 * nova onde um cenário mal escrito pudesse cair.
 *
 * Então este arquivo é uma **rede de regressão, não uma guarda provada**. Ele
 * passa a ter dente na Fase 5, quando o driver de API trouxer latência de verdade,
 * reordenação e falha parcial — nenhuma das três exercitada aqui. Mantê-lo custa
 * menos de dois segundos e documenta a expectativa; chamá-lo de prova seria
 * inventar uma garantia que a execução não sustenta.
 */
function lento(d: Driver): Driver {
  const umMacrotask = () => new Promise<void>((r) => { setTimeout(r, 0); });

  return new Proxy(d, {
    get(alvo, prop, receptor) {
      const valor = Reflect.get(alvo, prop, receptor);
      if (typeof valor !== 'function') return valor;
      return async (...args: unknown[]) => {
        // **O atraso vem ANTES de executar, e não só depois.**
        //
        // A primeira versão disto atrasava apenas a resolução: executava a
        // operação na hora e só demorava a devolver. Parecia certo e não provava
        // nada — uma mutação disparada sem `await` já tinha acontecido quando a
        // leitura seguinte chegasse, igualzinho ao driver normal. O cenário
        // temporário de verificação ficou vermelho nos DOIS drivers, que é como
        // esse defeito apareceu.
        //
        // Atrasar antes é o que HTTP faz: entre pedir e o servidor agir existe
        // uma viagem. Só assim um cenário que confie em efeito imediato falha
        // aqui e passa lá.
        await umMacrotask();
        const saida = await (valor as (...a: unknown[]) => unknown).apply(alvo, args);
        await umMacrotask();
        return saida;
      };
    },
  }) as Driver;
}

const criarDriverLento = async (): Promise<MundoDeTeste> => {
  const mundo = await criarDriverLocal();
  // `encerrar` fica sem atraso de propósito: é desmontagem, não operação de
  // domínio, e um cenário nunca a observa.
  return { driver: lento(mundo.driver), encerrar: mundo.encerrar };
};

rodarContrato('adaptador local, artificialmente lento', criarDriverLento);
