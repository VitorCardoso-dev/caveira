import {
  ArrowLeft,
  BarChart3,
  Brain,
  CircleDollarSign,
  Dumbbell,
  Flag,
  ListTodo,
  Moon,
  Settings2,
  Target,
  Timer,
  Trophy,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useRoute } from "wouter";

const modules: Record<string, { title: string; eyebrow: string; description: string; icon: LucideIcon; phase: string }> = {
  habitos: { title: "Hábitos", eyebrow: "Disciplina diária", description: "O núcleo de hábitos entra na Fase 2 com frequências, pausas planejadas, histórico e sequências auditáveis.", icon: Brain, phase: "Fase 2" },
  tarefas: { title: "Tarefas", eyebrow: "Execução", description: "O gerenciador de tarefas será conectado à priorização, recorrência, subtarefas e visualizações por período.", icon: ListTodo, phase: "Fase 2" },
  metas: { title: "Metas", eyebrow: "Direção", description: "Metas mensuráveis, marcos e progresso serão construídos sobre a base persistente da Fase 1.", icon: Target, phase: "Fase 2" },
  foco: { title: "Modo foco", eyebrow: "Presença", description: "O temporizador Pomodoro e o histórico de sessões serão adicionados na próxima etapa.", icon: Timer, phase: "Fase 2" },
  treinos: { title: "Treinos", eyebrow: "Corpo", description: "Biblioteca de exercícios, fichas, cargas e evolução física entram na Fase 3.", icon: Dumbbell, phase: "Fase 3" },
  alimentacao: { title: "Alimentação", eyebrow: "Nutrição", description: "Diário alimentar, hidratação e metas nutricionais entram na Fase 4.", icon: Utensils, phase: "Fase 4" },
  financas: { title: "Finanças", eyebrow: "Clareza", description: "Receitas, despesas, orçamento e análise com IA entram na Fase 5, com privacidade como regra.", icon: CircleDollarSign, phase: "Fase 5" },
  recompensas: { title: "Recompensas", eyebrow: "Lazer sustentável", description: "A carteira de lazer e as regras de desbloqueio entram na Fase 6.", icon: Trophy, phase: "Fase 6" },
  relatorios: { title: "Relatórios", eyebrow: "Leitura do processo", description: "A central de análise integrada entra na Fase 7, sem confundir correlação com causalidade.", icon: BarChart3, phase: "Fase 7" },
  configuracoes: { title: "Configurações", eyebrow: "Controle", description: "Preferências, backup, exportação e instalação PWA entram na Fase 7.", icon: Settings2, phase: "Fase 7" },
};

export default function ModulePage() {
  const [, params] = useRoute("/:module");
  const module = params?.module ? modules[params.module] : undefined;

  if (!module) {
    return <div className="min-h-screen bg-caveira-bg p-8 text-caveira-text">Módulo não encontrado.</div>;
  }

  const Icon = module.icon;
  return (
    <div className="min-h-screen bg-caveira-bg text-caveira-text">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12 lg:px-12">
        <Link href="/" className="mb-12 inline-flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-caveira-muted transition hover:text-caveira-text">
          <ArrowLeft size={16} /> voltar ao painel
        </Link>
        <div className="max-w-2xl">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-caveira-border bg-caveira-panel text-caveira-red">
            <Icon size={26} />
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-caveira-red">{module.eyebrow} · {module.phase}</p>
          <h1 className="mb-5 font-display text-5xl font-extrabold tracking-[-0.06em] text-caveira-text sm:text-7xl">{module.title}</h1>
          <p className="max-w-xl text-lg leading-8 text-caveira-muted">{module.description}</p>
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-caveira-border bg-caveira-panel/70 p-5 text-sm leading-6 text-caveira-muted">
            <Moon className="mt-0.5 shrink-0 text-caveira-green" size={18} />
            <span>O CAVEIRA está sendo construído por etapas. O dashboard já está conectado ao banco e pronto para receber os registros reais deste módulo.</span>
          </div>
          <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-caveira-text px-5 py-3 text-sm font-bold text-caveira-bg transition hover:bg-white">
            continuar no dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
