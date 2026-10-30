import { useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Home as HomeIcon,
  ListTodo,
  Plus,
  Skull,
  Target,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CategoryPicker } from "@/components/CategoryPicker";

const navigation: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Painel", href: "/", icon: HomeIcon },
  { label: "Hábitos", href: "/habitos", icon: Activity },
  { label: "Tarefas", href: "/tarefas", icon: ListTodo },
  { label: "Metas", href: "/metas", icon: Target },
  { label: "Treinos", href: "/treinos", icon: Dumbbell },
  { label: "Recompensas", href: "/recompensas", icon: Trophy },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Perfil", href: "/perfil", icon: UserRound },
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

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function QuickDialog({ kind, onClose, onSaved }: { kind: "habit" | "task" | "goal"; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [target, setTarget] = useState("100");
  const [automationType, setAutomationType] = useState<"tasks">("tasks");
  const [taskGoalId, setTaskGoalId] = useState("");
  const [deadline, setDeadline] = useState("");
  const createHabit = trpc.habits.create.useMutation();
  const createTask = trpc.tasks.create.useMutation();
  const createGoal = trpc.goals.create.useMutation();
  const snapshot = trpc.dashboard.snapshot.useQuery({ today: localDayKey() }, { refetchOnWindowFocus: false });
  const pending = createHabit.isPending || createTask.isPending || createGoal.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      if (kind === "habit") {
        await createHabit.mutateAsync({ name, category: category || undefined, frequency: "daily" });
        toast.success("Hábito registrado.");
      } else if (kind === "task") {
        await createTask.mutateAsync({ title: name, category: category || undefined, dueDate: deadline || null, goalId: taskGoalId ? Number(taskGoalId) : null });
        toast.success("Tarefa registrada.");
      } else {
        await createGoal.mutateAsync({ title: name, category: category || undefined, target: Number(target) || 100, deadline: deadline || null, automationType, automationRefId: null });
        toast.success("Meta registrada.");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    }
  };

  const title = kind === "habit" ? "Novo hábito" : kind === "task" ? "Nova tarefa" : "Nova meta";
  const label = kind === "habit" ? "Nome do hábito" : kind === "task" ? "Nome da tarefa" : "Qual é a meta?";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl border border-caveira-border bg-caveira-panel p-6 shadow-2xl shadow-black/40">
        <div className="mb-6 flex items-start justify-between">
          <div><p className="eyebrow">registro rápido</p><h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.04em]">{title}</h2></div>
          <button onClick={onClose} className="icon-button" aria-label="Fechar"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="field-label">{label}<input autoFocus value={name} onChange={event => setName(event.target.value)} className="field-input" placeholder={kind === "habit" ? "Ex.: leitura de 20 minutos" : kind === "task" ? "Ex.: revisar o planejamento da semana" : "Ex.: concluir o ciclo de treino"} /></label>
          <div className="field-label">Categoria <CategoryPicker value={category} onChange={setCategory} /></div>
          {kind === "goal" && <label className="field-label">Alvo mensurável <input type="number" min="1" value={target} onChange={event => setTarget(event.target.value)} className="field-input" /></label>}
          {kind === "goal" && <label className="field-label">Atualização <select value={automationType} className="field-input" aria-label="Acompanhamento automático"><option value="tasks">Tarefas concluídas</option></select><span className="mt-2 block text-[10px] normal-case tracking-normal text-caveira-muted">Toda meta nova acompanha registros reais; tarefas vinculadas atualizam este progresso.</span></label>}
          {kind === "task" && <label className="field-label">Meta vinculada <select value={taskGoalId} onChange={event => setTaskGoalId(event.target.value)} className="field-input"><option value="">Nenhuma</option>{snapshot.data?.goals.filter(goal => goal.automationType === "tasks").map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>}
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

function LifeChart({ points }: { points: Array<{ day: string; points: number; completedHabits: number; completedTasks: number; focusMinutes: number }> }) {
  const max = Math.max(8, ...points.map(item => item.points));
  const width = 760;
  const height = 220;
  const coords = points.map((item, index) => ({ ...item, x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width, y: height - 22 - (item.points / max) * (height - 44) }));
  const path = coords.map((item, index) => `${index === 0 ? "M" : "L"} ${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(" ");
  return <div className="panel-card"><div className="section-heading"><div><p className="eyebrow text-caveira-red">linha de evolução · 14 dias</p><h2 className="section-title">O pulso da sua vida</h2></div><span className="status-tag green">pontos reais</span></div><div className="overflow-hidden rounded-2xl border border-caveira-border bg-[#0f1013] p-3"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de linha dos pontos diários" className="h-56 w-full"><defs><linearGradient id="lifeArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#e53935" stopOpacity=".32" /><stop offset="100%" stopColor="#e53935" stopOpacity="0" /></linearGradient></defs>{[0, 1, 2, 3].map(line => <line key={line} x1="0" x2={width} y1={22 + line * 58} y2={22 + line * 58} stroke="#29292f" strokeDasharray="3 7" />)}<path d={`${path} L ${width} ${height - 22} L 0 ${height - 22} Z`} fill="url(#lifeArea)" /><path d={path} fill="none" stroke="#e53935" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />{coords.map(item => <circle key={item.day} cx={item.x} cy={item.y} r="4" fill="#0f1013" stroke="#b7f36b" strokeWidth="2" />)}</svg><div className="mt-1 flex justify-between gap-2 font-mono text-[10px] text-caveira-muted"><span>{points[0]?.day.slice(5).split("-").reverse().join("/")}</span><span>{points[Math.floor(points.length / 2)]?.day.slice(5).split("-").reverse().join("/")}</span><span>{points.at(-1)?.day.slice(5).split("-").reverse().join("/")}</span></div></div><p className="mt-4 text-xs leading-5 text-caveira-muted">Cada ponto considera ações concluídas e deduplica hábitos e tarefas da mesma categoria no mesmo dia. A linha não inventa desempenho: ela mostra o que foi registrado.</p></div>;
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const today = useMemo(localDayKey, []);
  const date = useMemo(longDate, []);
  const snapshotQuery = trpc.dashboard.snapshot.useQuery({ today }, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const reportQuery = trpc.reports.summary.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const pointsQuery = trpc.points.weekly.useQuery({ today }, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const toggleHabit = trpc.habits.toggleToday.useMutation({ onSuccess: () => snapshotQuery.refetch() });
  const toggleTask = trpc.tasks.toggleComplete.useMutation({ onSuccess: () => snapshotQuery.refetch(), onError: error => toast.error(error.message) });
  const [dialog, setDialog] = useState<"habit" | "task" | "goal" | null>(null);

  if (loading || snapshotQuery.isLoading || reportQuery.isLoading || pointsQuery.isLoading) {
    return <div className="min-h-screen bg-caveira-bg p-6 text-caveira-muted"><div className="mx-auto max-w-7xl animate-pulse space-y-6"><div className="h-20 rounded-3xl bg-caveira-panel" /><div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-32 rounded-2xl bg-caveira-panel" />)}</div><div className="h-96 rounded-3xl bg-caveira-panel" /></div></div>;
  }

  const data = snapshotQuery.data;
  const report = reportQuery.data;
  const points = pointsQuery.data;
  if (!data || !user) return <div className="min-h-screen bg-caveira-bg" />;
  const progressGoals = data.goals.map(goal => ({ ...goal, percentage: Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100)) }));
  const refresh = () => snapshotQuery.refetch();
  return (
    <div className="min-h-screen bg-caveira-bg text-caveira-text">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-caveira-border bg-caveira-bg/95 px-5 py-6 backdrop-blur lg:block">
        <Link href="/perfil" className="mb-12 flex items-center gap-3 px-2"><div className="brand-mark overflow-hidden p-0"><img src="/caveira-photo-logo.png" alt="Logo CAVEIRA" className="h-full w-full object-cover" /></div><div><p className="font-display text-lg font-black tracking-[0.18em]">CAVEIRA</p><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-caveira-muted">evolução integral</p></div></Link>
        <p className="eyebrow mb-3 px-2">comando</p><SideNav />
        <div className="absolute inset-x-5 bottom-6 rounded-2xl border border-caveira-border bg-caveira-panel p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-caveira-muted">sistema</span><span className="status-dot" /></div><p className="text-sm font-semibold">Operação privada</p><p className="mt-1 text-xs leading-5 text-caveira-muted">Seus registros ficam no seu espaço autenticado.</p></div>
      </aside>

      <div className="lg:pl-[248px]"><header className="sticky top-0 z-20 border-b border-caveira-border bg-caveira-bg/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8"><div className="flex items-center gap-3"><Link href="/perfil" className="brand-mark overflow-hidden p-0 lg:hidden"><img src="/caveira-photo-logo.png" alt="Perfil" className="h-full w-full object-cover" /></Link><div><p className="eyebrow">{date}</p><h1 className="mt-1 font-display text-xl font-extrabold tracking-[-0.04em] sm:text-2xl">Bom dia, {firstName(user.name)}.</h1></div></div><div className="flex items-center gap-2 sm:gap-3"><Link href="/perfil" className="hidden h-9 w-9 overflow-hidden rounded-xl border border-caveira-border sm:block"><img src="/caveira-photo-logo.png" alt="Abrir perfil" className="h-full w-full object-cover" /></Link><span className="hidden items-center gap-2 rounded-full border border-caveira-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted sm:flex"><span className="status-dot" /> sistema online</span></div></div></header>
        <main className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 pb-28 sm:px-8 lg:py-9 lg:pb-12">
          <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="hero-card"><div className="relative z-10 max-w-lg"><p className="eyebrow text-caveira-red">placar de hoje</p><div className="mt-3 flex items-end gap-3"><span className="font-display text-7xl font-black leading-none tracking-[-0.09em] sm:text-8xl">{data.score}</span><span className="mb-2 text-lg font-bold text-caveira-muted">%</span></div><p className="mt-4 max-w-sm text-sm leading-6 text-caveira-muted">A pontuação é calculada sobre hábitos concluídos hoje e tarefas já finalizadas.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={() => setDialog("habit")} className="button-primary"><Plus size={15} /> registrar hábito</button><button onClick={() => setDialog("task")} className="button-secondary">nova tarefa <ArrowUpRight size={15} /></button></div></div><div className="hero-grid" /><div className="hero-line" /></div>
            <div className="grid grid-cols-2 gap-4"><Metric label="Consistência" value={`${data.streak} dias`} detail="sequência atual" icon={Flame} accent="red" /><Metric label="Hábitos" value={`${data.counts.completedHabitsToday}/${data.counts.habits}`} detail="concluídos hoje" icon={CheckCircle2} accent="green" /><Metric label="Prioridades" value={data.counts.openTasks} detail="tarefas abertas" icon={ListTodo} /><Metric label="Foco" value={`${data.counts.weeklyFocusMinutes}m`} detail="nos últimos 7 dias" icon={Clock3} /></div>
          </section>
          {points && <section className="panel-card"><div className="section-heading"><div><p className="eyebrow text-caveira-red">placar semanal · {points.start} até {points.today}</p><h2 className="section-title">Pontos reais, sem exagero</h2></div><span className="status-tag green">carteira {points.walletBalance} pts</span></div><div className="grid gap-3 sm:grid-cols-4"><Metric label="saldo semanal" value={`${points.net} pts`} detail="ganhos menos perdas" icon={Trophy} accent={points.net >= 0 ? "green" : "red"} /><Metric label="ganhos" value={`+${points.earned}`} detail="ações concluídas" icon={CheckCircle2} accent="green" /><Metric label="perdas" value={`-${points.lost}`} detail={`${points.breakdown.overdueTasks} prazos vencidos`} icon={ListTodo} accent="red" /><Metric label="cumprimento" value={`${points.completionRate}%`} detail="obrigações observadas" icon={Target} /></div><p className="mt-4 text-xs leading-5 text-caveira-muted">A pontuação nasce da categoria: Alimentação 8, Trabalho 7, Estudos/Financeiro 6, Físico/Saúde/Desenvolvimento 5, Hábitos/Mente/Relacionamentos 4 e Outros 3. No mesmo dia e categoria, a maior ação evita duplicidade entre hábito e tarefa.</p></section>}

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">ritual de hoje</p><h2 className="section-title">Hábitos em campo</h2></div><button onClick={() => setDialog("habit")} className="icon-button" aria-label="Adicionar hábito"><Plus size={17} /></button></div>{data.habits.length === 0 ? <EmptyState icon={Activity} title="Nenhum hábito cadastrado" action="Criar primeiro hábito" onClick={() => setDialog("habit")} /> : <div className="space-y-2">{data.habits.slice(0, 5).map(habit => <div key={habit.id} className={`record-row ${habit.completedToday ? "record-complete" : ""}`}><button onClick={() => toggleHabit.mutate({ habitId: habit.id, day: today, completed: !habit.completedToday })} className={`check-button ${habit.completedToday ? "checked" : ""}`} aria-label={habit.completedToday ? "Desmarcar hábito" : "Concluir hábito"}>{habit.completedToday && <Check size={14} />}</button><div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${habit.completedToday ? "line-through opacity-60" : ""}`}>{habit.name}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted">{habit.category} · {habit.streak} {habit.streak === 1 ? "dia" : "dias"}</p></div><span className={`status-tag ${habit.completedToday ? "green" : ""}`}>{habit.completedToday ? "feito" : "pendente"}</span></div>)}</div>}{data.habits.length > 5 && <Link href="/habitos" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-caveira-muted hover:text-caveira-text">ver todos <ChevronRight size={14} /></Link>}</div>
            <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">próximo movimento</p><h2 className="section-title">Tarefas abertas</h2></div><button onClick={() => setDialog("task")} className="icon-button" aria-label="Adicionar tarefa"><Plus size={17} /></button></div>{data.tasks.length === 0 ? <EmptyState icon={ListTodo} title="Nenhuma tarefa aberta" action="Adicionar tarefa" onClick={() => setDialog("task")} /> : <div className="space-y-2">{data.tasks.map(task => <div key={task.id} className="record-row"><button onClick={() => toggleTask.mutate({ taskId: task.id, completed: true, today })} className="check-button" aria-label="Concluir tarefa"><Check size={13} /></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted">{task.category}{task.dueDate ? ` · prazo ${shortDate(task.dueDate)}` : ""}</p></div><span className="status-tag green">+{task.points} pts</span></div>)}</div>}{data.tasks.length > 0 && <Link href="/tarefas" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-caveira-muted hover:text-caveira-text">abrir tarefas <ChevronRight size={14} /></Link>}</div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1fr_0.82fr]">
            <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">direção</p><h2 className="section-title">Metas em movimento</h2></div><button onClick={() => setDialog("goal")} className="icon-button" aria-label="Adicionar meta"><Plus size={17} /></button></div>{progressGoals.length === 0 ? <EmptyState icon={Target} title="Nenhuma meta definida" action="Criar primeira meta" onClick={() => setDialog("goal")} /> : <div className="space-y-5">{progressGoals.map(goal => <div key={goal.id}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{goal.title}</span><span className="font-mono text-xs text-caveira-green">{goal.percentage}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${goal.percentage}%` }} /></div><p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-caveira-muted">{goal.category} · {goal.progress}/{goal.target}</p></div>)}</div>}</div>
            {report?.dailyStats ? <LifeChart points={report.dailyStats} /> : <div className="panel-card"><p className="text-sm text-caveira-muted">O gráfico aparecerá assim que houver registros suficientes.</p></div>}
            <div className="panel-card flex flex-col justify-between"><div><p className="eyebrow">atalhos</p><h2 className="section-title">Registrar agora</h2><p className="mt-3 text-sm leading-6 text-caveira-muted">Alimente o painel com o que realmente aconteceu.</p></div><div className="mt-6 grid grid-cols-2 gap-2"><button onClick={() => setDialog("habit")} className="shortcut-button"><Activity size={16} /> hábito</button><button onClick={() => setDialog("task")} className="shortcut-button"><ListTodo size={16} /> tarefa</button><button onClick={() => setDialog("goal")} className="shortcut-button"><Target size={16} /> meta</button></div></div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/treinos" className="panel-card transition hover:border-caveira-red"><p className="eyebrow">corpo</p><p className="mt-2 font-display text-2xl font-extrabold">{report?.counts.training ?? 0}</p><p className="mt-1 text-xs text-caveira-muted">registros de treino</p></Link>
            
            
            <Link href="/recompensas" className="panel-card transition hover:border-caveira-green"><p className="eyebrow">lazer</p><p className="mt-2 font-display text-2xl font-extrabold">{report?.records.filter(record => record.module === "recompensas").length ?? 0}</p><p className="mt-1 text-xs text-caveira-muted">recompensas cadastradas</p></Link>
            <Link href="/relatorios" className="panel-card transition hover:border-caveira-red"><p className="eyebrow">nível</p><p className="mt-2 font-display text-2xl font-extrabold">{report?.gamification.level ?? 1}</p><p className="mt-1 text-xs text-caveira-muted">{report?.gamification.xp ?? 0} XP acumulado</p></Link>
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
