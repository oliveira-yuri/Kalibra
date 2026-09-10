import { Link } from 'wouter';
import { Activity, Plus, MoreHorizontal, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useUser, useClerk } from '@clerk/react';

const programs = [
  {
    slug: 'setec-campinas',
    title: 'Concurso SETEC Campinas',
    type: 'Concurso Público',
    institution: 'SETEC',
    examDate: '17 JAN 2026',
    progress: 47.2,
    nextAction: 'Resolver 8 questões de porcentagem',
    active: true
  },
  {
    slug: 'bb-escriturario',
    title: 'Banco do Brasil - Escriturário',
    type: 'Concurso Público',
    institution: 'Banco do Brasil',
    examDate: 'A definir',
    progress: 12.5,
    nextAction: 'Leitura inicial: Sistema Financeiro',
    active: false
  }
];

export function Portal({ theme, onToggleTheme }: { theme: 'light' | 'dark', onToggleTheme: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const publicHomeUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
  
  return (
    <div className={`min-h-[100dvh] flex flex-col font-sans transition-colors ${theme === 'dark' ? 'bg-[#10131a] text-[#f0f0e8] selection:bg-[#283322]' : 'bg-[#f6f8f7] text-[#16232b] selection:bg-[#e5eed5]'}`}>
      <header className={`flex h-[68px] items-center justify-between px-5 md:px-9 border-b ${theme === 'dark' ? 'border-[#242a34]' : 'border-[#d5dede]'}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#d5f35b] text-[#10131a]">
            <Activity size={16} strokeWidth={2.6} />
          </span>
          <span className="text-[15px] font-bold tracking-[-0.04em]">
            kalibra<span className="text-[#d5f35b]">.</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button className="k-button k-button-quiet text-[12px]" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
          </button>
          <div className={`h-4 w-px ${theme === 'dark' ? 'bg-[#29313d]' : 'bg-[#d5dede]'}`}></div>
          <button className="k-button k-button-quiet text-[12px]" onClick={() => signOut({ redirectUrl: publicHomeUrl })}>
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1000px] mx-auto p-5 md:p-9 mt-4">
        <header className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="k-eyebrow mb-2">portal de estudos</p>
            <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.04em]">
              Bem-vinda, {user?.firstName || 'estudante'}.
            </h1>
          </div>
          <button className="k-button" disabled>
            <Plus size={14} /> Novo workspace
          </button>
        </header>

        <h2 className="text-[15px] font-semibold mb-4">Seus programas ativos</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {programs.map(program => (
            <Link 
              key={program.slug} 
              href={`/workspace/${program.slug}`}
              className={`block rounded-[4px] border transition-all duration-200 ${
                theme === 'dark' 
                  ? 'bg-[#131821] border-[#29313d] hover:border-[#68788b] hover:bg-[#1a2029]' 
                  : 'bg-white border-[#d5dede] hover:border-[#9eaeaa] hover:bg-[#f5f8f6]'
              }`}
            >
              <div className="p-5 border-b border-inherit">
                <div className="flex justify-between items-start mb-3">
                  <span className={`k-chip ${program.active ? 'k-chip-active' : ''}`}>{program.type}</span>
                  <button className="text-inherit opacity-50 hover:opacity-100" onClick={(e) => e.preventDefault()} aria-label="Opções">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] leading-tight mb-1">{program.title}</h3>
                <p className={`text-[12px] ${theme === 'dark' ? 'text-[#8e98a8]' : 'text-[#6f7b85]'}`}>
                  {program.institution} · Prova: {program.examDate}
                </p>
              </div>
              <div className="p-5 flex flex-col justify-between min-h-[140px]">
                <div>
                  <div className="flex justify-between items-center text-[12px] mb-2 font-medium">
                    <span>Progresso do edital</span>
                    <span className="k-mono">{program.progress}%</span>
                  </div>
                  <div className="k-progress">
                    <span style={{ width: `${program.progress}%` }} />
                  </div>
                </div>
                
                <div className={`mt-5 flex items-start gap-3 p-3 rounded-[3px] border ${
                  theme === 'dark' ? 'bg-[#171f1e] border-[#2a3832] text-[#d5f35b]' : 'bg-[#eef5d8] border-[#cbe1a8] text-[#5f7900]'
                }`}>
                  {program.active ? (
                    <Activity size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 opacity-80">Próximo passo</p>
                    <p className="text-[12px] font-medium leading-snug">{program.nextAction}</p>
                  </div>
                  <ArrowRight size={14} className="self-center opacity-60" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
