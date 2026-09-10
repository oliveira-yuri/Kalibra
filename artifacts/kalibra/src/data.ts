import { Subject, Topic, ReviewCard, Question, ErrorRecord, Recommendation, PlanItem, Note } from './types';

export const today = '17 dez 2025';

export const subjects: Subject[] = [
  { id: 'por', name: 'Língua Portuguesa', weight: 25, progress: 61, color: '#64d4d5', questions: 29 },
  { id: 'mat', name: 'Matemática e Raciocínio Lógico', weight: 25, progress: 48, color: '#d5f35b', questions: 34 },
  { id: 'esp', name: 'Conhecimentos Específicos', weight: 50, progress: 32, color: '#ff907d', questions: 21 },
];

export const topics: Topic[] = [
  { id: 't1', subject: 'Matemática', name: 'Razão, proporção e regra de três', status: 'em andamento', priority: 'alta', accuracy: 54, lastStudied: 'há 2 dias' },
  { id: 't2', subject: 'Matemática', name: 'Porcentagem e juros simples', status: 'em andamento', priority: 'alta', accuracy: 47, lastStudied: 'há 5 dias' },
  { id: 't3', subject: 'Matemática', name: 'Conjuntos numéricos', status: 'dominar', priority: 'baixa', accuracy: 81, lastStudied: 'há 8 dias' },
  { id: 't4', subject: 'Português', name: 'Interpretação de textos', status: 'em andamento', priority: 'alta', accuracy: 63, lastStudied: 'ontem' },
  { id: 't5', subject: 'Português', name: 'Concordância e regência', status: 'não iniciado', priority: 'média', accuracy: 0, lastStudied: 'nunca' },
  { id: 't6', subject: 'Conhecimentos Específicos', name: 'Lei de Acesso à Informação', status: 'em andamento', priority: 'alta', accuracy: 39, lastStudied: 'há 3 dias' },
  { id: 't7', subject: 'Conhecimentos Específicos', name: 'Administração pública direta', status: 'não iniciado', priority: 'média', accuracy: 0, lastStudied: 'nunca' },
  { id: 't8', subject: 'Conhecimentos Específicos', name: 'Ética no serviço público', status: 'dominar', priority: 'baixa', accuracy: 76, lastStudied: 'há 11 dias' },
];

export const initialCards: ReviewCard[] = [
  { id: 'r1', prompt: 'Em uma proporção 3:5, se o primeiro termo vale 24, qual é o segundo?', answer: '40. A razão de ampliação é 24 ÷ 3 = 8; então 5 × 8 = 40.', due: 'Hoje', difficulty: 'difícil', topic: 'Razão, proporção e regra de três' },
  { id: 'r2', prompt: 'Qual princípio garante que a administração pública só pode agir conforme a lei?', answer: 'Princípio da legalidade.', due: 'Hoje', difficulty: 'bom', topic: 'Administração pública direta' },
  { id: 'r3', prompt: 'Na interpretação textual, o que diferencia inferência de informação explícita?', answer: 'A inferência é construída a partir de pistas do texto; a informação explícita está declarada diretamente.', due: 'Amanhã', difficulty: 'fácil', topic: 'Interpretação de textos' },
];

export const questions: Question[] = [
  { id: 'q1', stem: 'Uma repartição reduziu em 20% o tempo médio de atendimento, que era de 45 minutos. Qual é o novo tempo médio?', options: ['36 minutos', '37 minutos', '38 minutos', '40 minutos'], correct: 0, explanation: 'Uma redução de 20% equivale a manter 80% do valor: 45 × 0,8 = 36 minutos.', subject: 'Matemática', topic: 'Porcentagem e juros simples', source: 'SETEC · simulado 03' },
  { id: 'q2', stem: 'Assinale a alternativa em que a relação de sentido está corretamente identificada.', options: ['“Embora” indica causa.', '“Portanto” indica conclusão.', '“Porque” indica condição.', '“Caso” indica concessão.'], correct: 1, explanation: '“Portanto” é um conectivo conclusivo e introduz uma consequência ou fechamento lógico.', subject: 'Português', topic: 'Interpretação de textos', source: 'SETEC · simulado 02' },
  { id: 'q3', stem: 'De acordo com a Lei de Acesso à Informação, a publicidade é regra e o sigilo é:', options: ['proibido em qualquer hipótese.', 'a regra para dados administrativos.', 'exceção, nos casos previstos em lei.', 'facultativo para o agente público.'], correct: 2, explanation: 'A LAI estabelece a publicidade como preceito geral e o sigilo como exceção, nas hipóteses legais.', subject: 'Conhecimentos Específicos', topic: 'Lei de Acesso à Informação', source: 'SETEC · bloco específico 01' },
];

export const initialErrors: ErrorRecord[] = [
  { id: 'e1', classification: 'falha de conceito', subject: 'Matemática', topic: 'Porcentagem e juros simples', date: '12 dez 2025', status: 'aberto', severity: 'alta' },
  { id: 'e2', classification: 'distração de leitura', subject: 'Português', topic: 'Interpretação de textos', date: '10 dez 2025', status: 'em revisão', severity: 'média' },
  { id: 'e3', classification: 'confusão normativa', subject: 'Conhecimentos Específicos', topic: 'Lei de Acesso à Informação', date: '08 dez 2025', status: 'aberto', severity: 'crítica' },
  { id: 'e4', classification: 'procedimento', subject: 'Matemática', topic: 'Razão, proporção e regra de três', date: '04 dez 2025', status: 'resolvido', severity: 'média' },
];

export const initialRecommendations: Recommendation[] = [
  { id: 'rec1', text: 'Adicionar 2 blocos de Matemática antes do próximo simulado.', rationale: 'Porcentagem e juros simples está 12 p.p. abaixo do corte de segurança e concentra 3 erros abertos.', impact: '+40 min/semana · ciclo atual', approved: false },
  { id: 'rec2', text: 'Antecipar a revisão de Lei de Acesso à Informação para hoje.', rationale: 'A última sessão teve baixa retenção e há um cartão vencido associado ao tópico.', impact: 'Move 1 sessão · sem alterar carga', approved: false },
  { id: 'rec3', text: 'Trocar o próximo bloco de teoria por 12 questões de interpretação.', rationale: 'Português já possui cobertura suficiente; prática contextualizada deve reduzir distrações de leitura.', impact: 'Substitui 25 min · hoje', approved: true },
];

export const initialPlan: PlanItem[] = [
  { id: 'p1', weekday: 'quarta-feira', date: '17 dez', label: 'Resolver 8 questões de porcentagem', subject: 'Matemática', duration: '25 min', kind: 'prática', tone: 'focus' },
  { id: 'p2', weekday: 'quinta-feira', date: '18 dez', label: 'Revisar Lei de Acesso à Informação', subject: 'Conhecimentos Específicos', duration: '20 min', kind: 'revisão', tone: 'review' },
  { id: 'p3', weekday: 'sexta-feira', date: '19 dez', label: 'Praticar interpretação de textos', subject: 'Português', duration: '30 min', kind: 'prática', tone: 'focus' },
  { id: 'p4', weekday: 'sábado', date: '20 dez', label: 'Revisar razão e proporção', subject: 'Matemática', duration: '20 min', kind: 'revisão', tone: 'review' },
  { id: 'p5', weekday: 'domingo', date: '21 dez', label: 'Estudar concordância e regência', subject: 'Português', duration: '25 min', kind: 'teoria', tone: 'quiet' },
  { id: 'p6', weekday: 'segunda-feira', date: '22 dez', label: 'Simulado misto · bloco 04', subject: 'Todas as matérias', duration: '45 min', kind: 'simulado', tone: 'focus' },
  { id: 'p7', weekday: 'terça-feira', date: '23 dez', label: 'Revisar pontos fracos do ciclo', subject: 'Diagnóstico', duration: '30 min', kind: 'revisão', tone: 'review' },
];

export const initialNotes: Note[] = [
  {
    id: 'n1',
    title: 'Porcentagem e juros simples',
    subject: 'Matemática',
    updatedAt: 'há 12 min',
    content: '# Porcentagem e juros simples\n\n## Regra principal\n\nPorcentagem é uma razão com denominador 100. Para evitar erro de operação, transforme a taxa em fator antes de calcular.\n\n`valor final = valor inicial × (1 ± taxa/100)`\n\n## Lembretes\n\n- aumento de 18% → fator **1,18**\n- redução de 20% → fator **0,80**\n- em variações sucessivas, aplique um fator depois do outro\n\n> Em uma redução, o resultado precisa ser menor que o valor inicial.',
  },
  {
    id: 'n2',
    title: 'Lei de Acesso à Informação',
    subject: 'Conhecimentos Específicos',
    updatedAt: 'ontem',
    content: '# Lei de Acesso à Informação\n\nA publicidade é o preceito geral e o sigilo é a exceção, nos casos previstos em lei.\n\n## Para revisar\n\n- transparência ativa e passiva\n- hipóteses legais de sigilo\n- prazo e recurso do pedido de acesso',
  },
  {
    id: 'n3',
    title: 'Interpretação: inferência x explícito',
    subject: 'Português',
    updatedAt: 'há 3 dias',
    content: '# Interpretação de textos\n\n**Informação explícita** está declarada diretamente no texto.\n\n**Inferência** é construída a partir de pistas e relações presentes no texto. Não é opinião livre: precisa ser sustentada por evidências do enunciado.',
  },
];
