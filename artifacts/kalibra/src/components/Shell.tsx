import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  Activity, ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, CircleDot,
  Menu, MoreHorizontal, Moon, Search, Settings2, Sun,
} from 'lucide-react';
import { useWorkspaces } from '@/store/workspaces';
import { topics } from '@/data';
import { QuickPracticeRegistro } from '@/components/QuickPracticeRegistro';
import { useToast } from '@/hooks/use-toast';
import { getDaysRemaining, formatShortDate, getCurrentDateFormatted, getCurrentTimeFormatted } from '@/lib/date-utils';
import { navItems } from '@/config/nav';
import type { Theme } from '@/types';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function IconLabel({ icon: Icon, children }: { icon: typeof Activity; children: ReactNode }) {
  return <span className="flex items-center gap-2"><Icon size={15} strokeWidth={1.8} />{children}</span>;
}

export function Shell({ children, theme, onToggleTheme, workspaceSlug = '' }: { children: ReactNode; theme: Theme; onToggleTheme: () => void; workspaceSlug?: string }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { workspaces, updateWorkspace } = useWorkspaces(user?.id);
  const workspace = workspaces.find((w) => w.slug === workspaceSlug);
  const [showPractice, setShowPractice] = useState(false);
  const { toast } = useToast();

  const handleRegisterPractice = (topicId: string, total: number, correct: number) => {
    const topic = topics.find(t => t.id === topicId);
    const percent = Math.round((correct / total) * 100);
    toast({ description: `${total} questões registradas em ${topic?.name.split(' ')[0]} · ${percent}%` });
  };

  const current = navItems.find((item) => {
    return item.href === '/' ? location === '/' : location.startsWith(item.href);
  }) ?? navItems[0];

  const cargoDate = workspace?.cargos?.find(c => c.id === workspace.selectedCargoId)?.examDate || workspace?.examDate || '';
  const cargoPeriod = workspace?.cargos?.find(c => c.id === workspace.selectedCargoId)?.period || '';

  return (
    <div className="kalibra-shell flex flex-col md:flex-row">
      <aside className="k-sidebar flex w-full flex-col md:fixed md:inset-y-0 md:w-[224px]">
        <div className="flex h-[68px] items-center justify-between border-b border-[#242a34] px-5">
          <Link href={`~${basePath}/portal`} className="flex items-center gap-3" data-testid="link-brand">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#d5f35b] text-[#10131a]"><Activity size={16} strokeWidth={2.6} /></span>
            <span className="text-[15px] font-bold tracking-[-0.04em]">kalibra<span className="text-[#d5f35b]">.</span></span>
          </Link>
          <button className="k-button k-button-quiet k-icon-button md:hidden" data-testid="button-mobile-menu" aria-label="Abrir menu"><Menu size={17} /></button>
        </div>
        <div className="hidden px-4 py-5 md:block">
          <p className="k-eyebrow mb-2">workspace ativo</p>
          <p className="text-[12px] font-medium text-[#e9e9e0]">{workspace?.title || 'Workspace'}</p>
          {workspace?.cargos && workspace.cargos.length > 0 && (
            <div className="mt-1 relative group">
              <select
                className="w-full bg-transparent border border-transparent hover:border-[#394452] dark:hover:border-[#35404e] rounded-sm text-[11px] font-medium text-[#8e98a8] outline-none appearance-none pr-5 py-1 cursor-pointer"
                value={workspace.selectedCargoId}
                onChange={(e) => updateWorkspace(workspace.slug, { selectedCargoId: e.target.value })}
                disabled={workspace.cargos.length === 1}
              >
                {workspace.cargos.map(c => <option key={c.id} value={c.id} className="bg-white dark:bg-[#131821] text-[#16232b] dark:text-[#8e98a8]">{c.name}</option>)}
              </select>
              {workspace.cargos.length > 1 && <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[#8e98a8]" />}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-[10px] text-[#8e98a8]">
            <CalendarDays size={12} />
            <span className="k-mono">{formatShortDate(cargoDate)}</span>
            {cargoPeriod && <span className="k-mono px-1">· per. {cargoPeriod}</span>}
            <span className="ml-auto k-focus k-mono">{getDaysRemaining(cargoDate)}</span>
          </div>
          <Link href={`~${basePath}/portal`} className="k-button k-button-quiet mt-4 w-full justify-start !px-0 text-[11px]" data-testid="link-back-to-portal">
            <ArrowLeft size={14} /> Voltar aos concursos
          </Link>
        </div>
        <nav className="k-mobile-nav flex-1 gap-1 px-2 pb-2 md:block md:px-3 md:py-3">
          <p className="k-eyebrow hidden px-3 pb-2 pt-1 md:block">navegação</p>
          {navItems.map((item) => {
             const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
             return <Link key={item.href} href={item.href} className={`k-nav-item ${active ? 'k-nav-item-active' : ''}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><item.icon size={16} /><span>{item.label}</span>{item.href === '/revisao' && <span className="ml-auto rounded-sm bg-[#ff907d] px-1.5 py-0.5 text-[9px] font-bold text-[#171416]">3</span>}</Link>;
          })}
        </nav>
        <div className="hidden border-t border-[#242a34] p-4 md:block">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#27352a] text-[10px] font-bold text-[#d5f35b]">
              {user?.firstName?.[0]?.toUpperCase() || 'E'}
            </span>
            <div>
              <p className="text-[11px] font-semibold">{user?.firstName || 'Estudante'}</p>
              <p className="text-[10px] text-[#8e98a8]">sessão de estudos</p>
            </div>
            <MoreHorizontal className="ml-auto text-[#8e98a8]" size={15} />
          </div>
          <button className="k-button k-button-quiet w-full justify-start px-1 text-[11px]" data-testid="button-settings"><Settings2 size={14} /> Preferências</button>
        </div>
      </aside>
      <main className="k-main min-h-[calc(100dvh-115px)] flex-1 md:ml-[224px] md:min-h-dvh">
        <header className="flex min-h-[68px] items-center justify-between border-b border-[#242a34] px-5 md:px-9 relative">
          <div><p className="k-eyebrow mb-1">{current.label}</p><h1 className="text-[15px] font-semibold tracking-[-0.02em]">{current.href === '/' ? 'Seu próximo passo, sem ruído.' : current.label}</h1></div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button className="k-button k-button-quiet k-icon-button" onClick={() => setShowPractice(true)} data-testid="button-practice" aria-label="Registrar prática"><CheckCircle2 size={16} /></button>
              {showPractice && <QuickPracticeRegistro topics={topics} onClose={() => setShowPractice(false)} onRegister={handleRegisterPractice} />}
            </div>
            <button className="k-button k-button-quiet k-icon-button" data-testid="button-search" aria-label="Buscar"><Search size={16} /></button>
            <button className="k-button k-button-quiet k-icon-button" data-testid="button-notifications" aria-label="Notificações"><CircleDot size={16} /></button>
            <button className="k-button k-button-quiet k-icon-button" onClick={onToggleTheme} data-testid="button-theme-toggle" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <span className="mx-1 h-5 w-px bg-[#29313d]" />
            <span className="hidden text-right sm:block"><span className="block text-[11px] font-medium">{getCurrentDateFormatted()}</span><span className="k-mono block text-[9px] text-[#8e98a8]">{getCurrentTimeFormatted()}</span></span>
          </div>
        </header>
        <div key={location} className="k-page-enter mx-auto max-w-[1440px] p-5 md:p-9">{children}</div>
      </main>
    </div>
  );
}
