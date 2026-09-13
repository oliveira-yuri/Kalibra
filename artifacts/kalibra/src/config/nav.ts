import { BookOpen, FileText, Gauge, Layers3, Lightbulb, ListChecks, NotebookPen, RotateCcw, ShieldAlert } from 'lucide-react';

export const navItems = [
  { href: '/', label: 'Visão geral', icon: Gauge },
  { href: '/edital', label: 'Edital', icon: ListChecks },
  { href: '/estudo', label: 'Estudo', icon: BookOpen },
  { href: '/notas', label: 'Notas', icon: NotebookPen },
  { href: '/revisao', label: 'Revisão', icon: RotateCcw },
  { href: '/questoes', label: 'Questões', icon: FileText },
  { href: '/diagnostico', label: 'Diagnóstico', icon: Layers3 },
  { href: '/erros', label: 'Erros', icon: ShieldAlert },
  { href: '/recomendacoes', label: 'Recomendações', icon: Lightbulb },
];
