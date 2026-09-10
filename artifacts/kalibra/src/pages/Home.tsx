import { Link } from 'wouter';
import { Activity, ArrowRight, Moon, Shield, Sun, Target, Zap } from 'lucide-react';

export function Home({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const dark = theme === 'dark';
  return (
    <div className={`k-page-enter min-h-[100dvh] flex flex-col font-sans transition-colors ${dark ? 'bg-[#10131a] text-[#f0f0e8] selection:bg-[#283322]' : 'bg-[#f6f8f7] text-[#16232b] selection:bg-[#e5eed5]'}`}>
      <header className={`flex h-20 items-center justify-between px-6 md:px-10 border-b ${dark ? 'border-[#242a34]' : 'border-[#d5dede]'}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#d5f35b] text-[#10131a]">
            <Activity size={18} strokeWidth={2.6} />
          </span>
          <span className="text-[17px] font-bold tracking-[-0.04em]">
            kalibra<span className="text-[#d5f35b]">.</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-[13px] font-medium">
          <button className="k-button k-button-quiet k-icon-button" onClick={onToggleTheme} aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link href="/sign-in" className={`transition-colors ${dark ? 'text-[#aeb8c5] hover:text-[#f0f0e8]' : 'text-[#52616c] hover:text-[#16232b]'}`}>
            Entrar
          </Link>
          <Link href="/sign-up" className="k-button k-button-primary border-none">
            Criar conta
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <span className="k-chip !bg-[#1c232e] !border-[#313a48] !text-[#aeb8c5] mb-6">
          SISTEMA OPERACIONAL DE ESTUDOS
        </span>
        <h1 className="text-[40px] md:text-[64px] font-semibold tracking-[-0.05em] leading-[1.05] max-w-[800px]">
          A precisão que <span className="text-[#d5f35b]">aprova.</span>
        </h1>
        <p className={`mt-6 text-[15px] md:text-[18px] max-w-[600px] leading-relaxed ${dark ? 'text-[#8e98a8]' : 'text-[#6f7b85]'}`}>
          Esqueça as planilhas genéricas. O Kalibra é um ambiente focado, construído para organizar seus editais, direcionar suas revisões e diagnosticar suas falhas com clareza.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/sign-up" className="k-button k-button-primary !h-12 !px-8 !text-[14px]">
            Começar agora <ArrowRight size={16} />
          </Link>
          <Link href="/sign-in" className="k-button k-button-quiet !h-12 !px-8 !text-[14px]">
            Já tenho uma conta
          </Link>
        </div>

        <div className="k-stagger mt-24 grid sm:grid-cols-3 gap-8 max-w-[900px] text-left">
          <div className={`k-card k-interactive-card p-6 ${dark ? '!bg-[#131821] !border-[#242c37]' : '!bg-white !border-[#d5dede]'}`}>
            <Target className="text-[#d5f35b] mb-4" size={24} />
            <h3 className="text-[15px] font-semibold mb-2">Foco no edital</h3>
            <p className={`text-[13px] leading-relaxed ${dark ? 'text-[#8e98a8]' : 'text-[#6f7b85]'}`}>Estruture o edital do seu concurso ou vestibular e saiba exatamente o que estudar a cada dia.</p>
          </div>
          <div className={`k-card k-interactive-card p-6 ${dark ? '!bg-[#131821] !border-[#242c37]' : '!bg-white !border-[#d5dede]'}`}>
            <Zap className="text-[#64d4d5] mb-4" size={24} />
            <h3 className="text-[15px] font-semibold mb-2">Revisão ativa</h3>
            <p className={`text-[13px] leading-relaxed ${dark ? 'text-[#8e98a8]' : 'text-[#6f7b85]'}`}>Sistema inteligente de flashcards que programa suas revisões com base na sua curva de esquecimento.</p>
          </div>
          <div className={`k-card k-interactive-card p-6 ${dark ? '!bg-[#131821] !border-[#242c37]' : '!bg-white !border-[#d5dede]'}`}>
            <Shield className="text-[#ff907d] mb-4" size={24} />
            <h3 className="text-[15px] font-semibold mb-2">Controle de erros</h3>
            <p className={`text-[13px] leading-relaxed ${dark ? 'text-[#8e98a8]' : 'text-[#6f7b85]'}`}>Diagnostique a causa de cada questão errada e foque na correção da raiz do problema.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
