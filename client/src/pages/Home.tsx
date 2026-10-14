import { useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Flame,
  Flag,
  Home as HomeIcon,
  ListTodo,
  Menu,
  Plus,
  Skull,
  Target,
  Timer,
  Trophy,
  Utensils,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const navigation: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Painel", href: "/", icon: HomeIcon },
  { label: "Hábitos", href: "/habitos", icon: Activity },
  { label: "Tarefas", href: "/tarefas", icon: ListTodo },
  { label: "Metas", href: "/metas", icon: Target },
  { label: "Foco", href: "/foco", icon: Timer },
  { label: "Treinos", href: "/treinos", icon: Flag },
  { label: "Alimentação", href: "/alimentacao", icon: Utensils },
  { label: "Finanças", href: "/financas", icon: CircleDollarSign },
  { label: "Recompensas", href: "/recompensas", icon: Trophy },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
];

function localDayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function longDate() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
}

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "operador";
}

function priorityLabel(priority: "low" | "medium" | "high") {
  return priority === "high" ? "alta" : priority === "medium" ? "média" : "baixa";
}

function shortDate(value: Date | string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function QuickDialog({ kind, onClose, onSaved }: { kind: "habit" | "task" | "goal"; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [target, setTarget] = useState("100");
  const [deadline, setDeadline] = useState("");
  const createHabit = trpc.habits.create.useMutation();
  const createTask = trpc.tasks.create.useMutation();
  const createGoal = trpc.goals.create.useMutation();
  const pending = createHabit.isPending || createTask.isPending || createGoal.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      if (kind === "habit") {
        await createHabit.mutateAsync({ name, category: category || undefined, frequency: "daily" });
        toast.success("Hábito registrado.");
      } else if (kind === "task") {
        await createTask.mutateAsync({ title: name, category: category || undefined, priority, dueDate: deadline || null });
        toast.success("Tarefa registrada.");
      } else {
        await createGoal.mutateAsync({ title: name, category: category || undefined, target: Number(target) || 100, deadline: deadline || null });
        toast.success("Meta registrada.");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    }
  };

  const title = kind === "habit" ? "Novo hábito" : kind === "task" ? "Nova tarefa" : "Nova meta";
  const label = kind === "habit" ? "Nome do hábito" : kind === "task" ? "O que precisa ser feito?" : "Qual é a meta?";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl border border-caveira-border bg-caveira-panel p-6 shadow-2xl shadow-black/40">
        <div className="mb-6 flex items-start justify-between">
          <div><p className="eyebrow">registro rápido</p><h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.04em]">{title}</h2></div>
          <button onClick={onClose} className="icon-button" aria-label="Fechar"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="field-label">{label}<input autoFocus value={name} onChange={event => setName(event.target.value)} className="field-input" placeholder={kind === "habit" ? "Ex.: leitura de 20 minutos" : kind === "task" ? "Ex.: revisar o planejamento da semana" : "Ex.: concluir o ciclo de treino"} /></label>
          <label className="field-label">Categoria <input value={category} onChange={event => setCategory(event.target.value)} className="field-input" placeholder={kind === "goal" ? "Pessoal, físico, financeiro..." : "Disciplina, trabalho..."} /></label>
          {kind === "task" && <label className="field-label">Prioridade<select value={priority} onChange={event => setPriority(event.target.value as typeof priority)} className="field-input"><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label>}
          {kind === "goal" && <label className="field-label">Alvo mensurável <input type="number" min="1" value={target} onChange={event => setTarget(event.target.value)} className="field-input" /></label>}
          {(kind === "task" || kind === "goal") && <label className="field-label">Prazo <input type="date" value={deadline} onChange={event => setDeadline(event.target.value)} className="field-input" /></label>}
          <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={onClose} className="button-secondary">Cancelar</button><button type="submit" disabled={pending || !name.trim()} className="button-primary">{pending ? "Salvando..." : "Salvar registro"}</button></div>
        </form>
      </div>
    </div>
  );
}

function SideNav({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav className={mobile ? "flex items-center justify-around" : "space-y-1"} aria-label="Navegação principal">
      {navigation.map(item => {
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} className={mobile ? "mobile-nav-item" : "side-nav-item"}><Icon size={mobile ? 18 : 17} /><span>{item.label}</span></Link>;
      })}
    </nav>
  );
}

function Metric({ label, value, detail, icon: Icon, accent = "default" }: { label: string; value: string | number; detail: string; icon: LucideIcon; accent?: "default" | "red" | "green" }) {
  return <div className="metric-card"><div className={`metric-icon ${accent}`}><Icon size={17} /></div><div className="min-w-0"><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">{detail}</p></div></div>;
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const today = useMemo(localDayKey, []);
  const date = useMemo(longDate, []);
  const snapshotQuery = trpc.dashboard.snapshot.useQuery({ today }, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const toggleHabit = trpc.habits.toggleToday.useMutation({ onSuccess: () => snapshotQuery.refetch() });
  const toggleTask = trpc.tasks.toggleComplete.useMutation({ onSuccess: () => snapshotQuery.refetch() });
  const [dialog, setDialog] = useState<"habit" | "task" | "goal" | null>(null);

  if (loading || snapshotQuery.isLoading) {
    return <div className="min-h-screen bg-caveira-bg p-6 text-caveira-muted"><div className="mx-auto max-w-7xl animate-pulse space-y-6"><div className="h-20 rounded-3xl bg-caveira-panel" /><div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-32 rounded-2xl bg-caveira-panel" />)}</div><div className="h-96 rounded-3xl bg-caveira-panel" /></div></div>;
  }

  const data = snapshotQuery.data;
  if (!data || !user) return <div className="min-h-screen bg-caveira-bg" />;
  const progressGoals = data.goals.map(goal => ({ ...goal, percentage: Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100)) }));
  const lastSeven = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${today}T12:00:00`);
    day.setDate(day.getDate() - (6 - index));
    return day.toISOString().slice(0, 10);
  });

  const refresh = () => snapshotQuery.refetch();
  return (
    <div className="min-h-screen bg-caveira-bg text-caveira-text">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-caveira-border bg-caveira-bg/95 px-5 py-6 backdrop-blur lg:block">
        <div className="mb-12 flex items-center gap-3 px-2"><div className="brand-mark"><Skull size={19} /></div><div><p className="font-display text-lg font-black tracking-[0.18em]">CAVEIRA</p><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-caveira-muted">evolução integral</p></div></div>
        <p className="eyebrow mb-3 px-2">comando</p><SideNav />
        <div className="absolute inset-x-5 bottom-6 rounded-2xl border border-caveira-border bg-caveira-panel p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-caveira-muted">sistema</span><span className="status-dot" /></div><p className="text-sm font-semibold">Operação privada</p><p className="mt-1 text-xs leading-5 text-caveira-muted">Seus registros ficam no seu espaço autenticado.</p></div>
      </aside>

      <div className="lg:pl-[248px]"><header className="sticky top-0 z-20 border-b border-caveira-border bg-caveira-bg/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8"><div className="flex items-center gap-3"><div className="brand-mark lg:hidden"><Skull size={16} /></div><div><p className="eyebrow">{date}</p><h1 className="mt-1 font-display text-xl font-extrabold tracking-[-0.04em] sm:text-2xl">Bom dia, {firstName(user.name)}.</h1></div></div><div className="flex items-center gap-2 sm:gap-3"><span className="hidden items-center gap-2 rounded-full border border-caveira-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted sm:flex"><span className="status-dot" /> sistema online</span><Link href="/foco" className="button-primary hidden sm:inline-flex"><Timer size={15} /> iniciar foco</Link><button className="icon-button" aria-label="Menu"><Menu size={18} /></button></div></div></header>
        <main className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 pb-28 sm:px-8 lg:py-9 lg:pb-12">
          <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="hero-card"><div className="relative z-10 max-w-lg"><p className="eyebrow text-caveira-red">placar de hoje</p><div className="mt-3 flex items-end gap-3"><span className="font-display text-7xl font-black leading-none tracking-[-0.09em] sm:text-8xl">{data.score}</span><span className="mb-2 text-lg font-bold text-caveira-muted">%</span></div><p className="mt-4 max-w-sm text-sm leading-6 text-caveira-muted">A pontuação é calculada sobre hábitos concluídos hoje e tarefas já finalizadas.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={() => setDialog("habit")} className="button-primary"><Plus size={15} /> registrar hábito</button><button onClick={() => setDialog("task")} className="button-secondary">nova tarefa <ArrowUpRight size={15} /></button></div></div><div className="hero-grid" /><div className="hero-line" /></div>
            <div className="grid grid-cols-2 gap-4"><Metric label="Consistência" value={`${data.streak} dias`} detail="sequência atual" icon={Flame} accent="red" /><Metric label="Hábitos" value={`${data.counts.completedHabitsToday}/${data.counts.habits}`} detail="concluídos hoje" icon={CheckCircle2} accent="green" /><Metric label="Prioridades" value={data.counts.openTasks} detail="tarefas abertas" icon={ListTodo} /><Metric label="Foco" value={`${data.counts.weeklyFocusMinutes}m`} detail="nos últimos 7 dias" icon={Clock3} /></div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">ritual de hoje</p><h2 className="section-title">Hábitos em campo</h2></div><button onClick={() => setDialog("habit")} className="icon-button" aria-label="Adicionar hábito"><Plus size={17} /></button></div>{data.habits.length === 0 ? <EmptyState icon={Activity} title="Nenhum hábito cadastrado" action="Criar primeiro hábito" onClick={() => setDialog("habit")} /> : <div className="space-y-2">{data.habits.slice(0, 5).map(habit => <div key={habit.id} className={`record-row ${habit.completedToday ? "record-complete" : ""}`}><button onClick={() => toggleHabit.mutate({ habitId: habit.id, day: today, completed: !habit.completedToday })} className={`check-button ${habit.completedToday ? "checked" : ""}`} aria-label={habit.completedToday ? "Desmarcar hábito" : "Concluir hábito"}>{habit.completedToday && <Check size={14} />}</button><div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${habit.completedToday ? "line-through opacity-60" : ""}`}>{habit.name}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted">{habit.category} · {habit.streak} {habit.streak === 1 ? "dia" : "dias"}</p></div><span className={`status-tag ${habit.completedToday ? "green" : ""}`}>{habit.completedToday ? "feito" : "pendente"}</span></div>)}</div>}{data.habits.length > 5 && <Link href="/habitos" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-caveira-muted hover:text-caveira-text">ver todos <ChevronRight size={14} /></Link>}</div>
            <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">próximo movimento</p><h2 className="section-title">Prioridades</h2></div><button onClick={() => setDialog("task")} className="icon-button" aria-label="Adicionar tarefa"><Plus size={17} /></button></div>{data.tasks.length === 0 ? <EmptyState icon={ListTodo} title="Nenhuma tarefa aberta" action="Adicionar tarefa" onClick={() => setDialog("task")} /> : <div className="space-y-2">{data.tasks.map(task => <div key={task.id} className="record-row"><button onClick={() => toggleTask.mutate({ taskId: task.id, completed: true })} className="check-button" aria-label="Concluir tarefa"><Check size={13} /></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted">{task.category}{task.dueDate ? ` · prazo ${shortDate(task.dueDate)}` : ""}</p></div><span className={`priority-tag ${task.priority}`}>{priorityLabel(task.priority)}</span></div>)}</div>}{data.tasks.length > 0 && <Link href="/tarefas" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-caveira-muted hover:text-caveira-text">abrir tarefas <ChevronRight size={14} /></Link>}</div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1fr_0.82fr]">
            <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">direção</p><h2 className="section-title">Metas em movimento</h2></div><button onClick={() => setDialog("goal")} className="icon-button" aria-label="Adicionar meta"><Plus size={17} /></button></div>{progressGoals.length === 0 ? <EmptyState icon={Target} title="Nenhuma meta definida" action="Criar primeira meta" onClick={() => setDialog("goal")} /> : <div className="space-y-5">{progressGoals.map(goal => <div key={goal.id}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{goal.title}</span><span className="font-mono text-xs text-caveira-green">{goal.percentage}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${goal.percentage}%` }} /></div><p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted">{goal.category} · {goal.progress}/{goal.target}</p></div>)}</div>}</div>
            <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">ritmo recente</p><h2 className="section-title">Pulso da semana</h2></div><Activity size={18} className="text-caveira-muted" /></div><div className="flex h-40 items-end justify-between gap-2 border-b border-caveira-border pb-3 pt-5">{lastSeven.map(day => { const active = data.activityDates.includes(day); return <div key={day} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className={`w-full rounded-t-md transition-all ${active ? "bg-caveira-red" : "bg-caveira-border"}`} style={{ height: active ? "58%" : "12%" }} /><span className="font-mono text-[10px] text-caveira-muted">{day.slice(8)}</span></div>; })}</div><p className="mt-4 text-xs leading-5 text-caveira-muted">Cada marca representa pelo menos uma ação registrada. Sem interpretações além do que foi feito.</p></div>
            <div className="panel-card flex flex-col justify-between"><div><p className="eyebrow">atalhos</p><h2 className="section-title">Registrar agora</h2><p className="mt-3 text-sm leading-6 text-caveira-muted">Alimente o painel com o que realmente aconteceu.</p></div><div className="mt-6 grid grid-cols-2 gap-2"><button onClick={() => setDialog("habit")} className="shortcut-button"><Activity size={16} /> hábito</button><button onClick={() => setDialog("task")} className="shortcut-button"><ListTodo size={16} /> tarefa</button><button onClick={() => setDialog("goal")} className="shortcut-button"><Target size={16} /> meta</button><Link href="/foco" className="shortcut-button"><Timer size={16} /> foco</Link></div></div>
          </section>
        </main>
      </div>
      <div className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-caveira-border bg-caveira-panel/95 p-2 shadow-2xl backdrop-blur lg:hidden"><SideNav mobile /></div>
      {dialog && <QuickDialog kind={dialog} onClose={() => setDialog(null)} onSaved={refresh} />}
    </div>
  );
}

function EmptyState({ icon: Icon, title, action, onClick }: { icon: LucideIcon; title: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><Icon size={25} className="text-caveira-muted" /><p className="mt-3 text-sm font-semibold">{title}</p><button onClick={onClick} className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-caveira-red hover:text-caveira-text">{action} <ChevronRight className="inline" size={13} /></button></div>;
}
