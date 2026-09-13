import { Link } from 'wouter';

export function NotFound() {
  return <div className="flex min-h-[70vh] flex-col items-center justify-center text-center"><span className="k-mono text-[52px] text-[#d5f35b]">404</span><h2 className="mt-4 text-xl font-semibold">Página fora do ciclo</h2><p className="mt-2 text-[12px] text-[#8e98a8]">Este caminho não existe no workspace atual.</p><Link href="/" className="k-button k-button-primary mt-6" data-testid="link-back-dashboard">Voltar à visão geral</Link></div>;
}
