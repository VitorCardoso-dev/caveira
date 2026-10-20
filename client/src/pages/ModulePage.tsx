import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CircleDollarSign,
  Clock3,
  Download,
  Dumbbell,
  FileJson,
  Flag,
  Flame,
  ListTodo,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Settings2,
  Target,
  Timer,
  Trash2,
  Trophy,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const icons: Record<string, LucideIcon> = { treinos: Dumbbell, alimentacao: Utensils, financas: CircleDollarSign, recompensas: Trophy, relatorios: BarChart3, configuracoes: Settings2, foco: Timer, habitos: Activity, tarefas: ListTodo, metas: Target };
const titles: Record<string, { title: string; eyebrow: string; description: string }> = {
  habitos: { title: "Hábitos", eyebrow: "disciplina diária", description: "Registre o que sustenta sua rotina e acompanhe sua sequência sem apagar o histórico." },
  tarefas: { title: "Tarefas", eyebrow: "execução", description: "Transforme prioridades em ações pequenas, datadas e verificáveis." },
  metas: { title: "Metas", eyebrow: "direção", description: "Mantenha seus objetivos mensuráveis e atualize o progresso pelo que foi feito." },
  foco: { title: "Modo foco", eyebrow: "presença", description: "Um bloco de atenção de cada vez. O tempo concluído entra no histórico." },
  treinos: { title: "Treinos", eyebrow: "corpo", description: "Registre exercícios, cargas, séries e cardio. O CAVEIRA não prescreve carga nem ignora recuperação." },
  alimentacao: { title: "Alimentação", eyebrow: "nutrição", description: "Registre refeições e valores aproximados. Estimativas continuam editáveis." },
  financas: { title: "Finanças", eyebrow: "clareza", description: "Receitas e despesas reais, com saldo do período e impacto visível." },
  recompensas: { title: "Recompensas", eyebrow: "lazer sustentável", description: "Cadastre momentos de lazer para conquistar com transparência, sem culpa." },
  relatorios: { title: "Relatórios", eyebrow: "leitura do processo", description: "Veja o que foi registrado, sem transformar correlação em causalidade." },
  configuracoes: { title: "Configurações", eyebrow: "controle", description: "Preferências, exportação e restauração dos registros do seu espaço." },
};

type ModuleCode = "treinos" | "alimentacao" | "financas" | "recompensas";
type Details = Record<string, string | number | boolean>;

type Field = { key: string; label: string; type?: "text" | "number" | "select"; placeholder?: string; options?: string[] };
const recordFields: Record<ModuleCode, Field[]> = {
  treinos: [
    { key: "muscleGroup", label: "Grupo muscular", placeholder: "Peito, costas, pernas..." },
    { key: "equipment", label: "Equipamento", placeholder: "Barra, halter, peso corporal..." },
    { key: "sets", label: "Séries", type: "number", placeholder: "4" },
    { key: "reps", label: "Repetições", type: "number", placeholder: "8" },
    { key: "weightKg", label: "Carga (kg)", type: "number", placeholder: "Sem carga / opcional" },
    { key: "restSeconds", label: "Descanso (segundos)", type: "number", placeholder: "90" },
  ],
  alimentacao: [
    { key: "mealType", label: "Refeição", type: "select", options: ["Café da manhã", "Almoço", "Jantar", "Lanche", "Pós-treino"] },
    { key: "quantity", label: "Quantidade", placeholder: "1 porção / 250 g" },
    { key: "protein", label: "Proteínas (g)", type: "number", placeholder: "Estimativa" },
    { key: "carbs", label: "Carboidratos (g)", type: "number", placeholder: "Estimativa" },
    { key: "fat", label: "Gorduras (g)", type: "number", placeholder: "Estimativa" },
    { key: "estimated", label: "Valores estimados", type: "select", options: ["Sim — aproximados", "Não — conferidos"] },
  ],
  financas: [
    { key: "type", label: "Tipo", type: "select", options: ["expense", "income"] },
    { key: "category", label: "Categoria", placeholder: "Moradia, alimentação, trabalho..." },
    { key: "paymentMethod", label: "Forma de pagamento", placeholder: "Pix, cartão, dinheiro..." },
    { key: "recurring", label: "Recorrência", type: "select", options: ["Não", "Sim"] },
  ],
  recompensas: [
    { key: "category", label: "Categoria", placeholder: "Série, hobby, descanso..." },
    { key: "durationMinutes", label: "Duração (minutos)", type: "number", placeholder: "45" },
    { key: "costCents", label: "Custo estimado (R$)", type: "number", placeholder: "0" },
    { key: "pointsRequired", label: "Pontos necessários", type: "number", placeholder: "100" },
    { key: "condition", label: "Condição de desbloqueio", placeholder: "Concluir prioridades da semana..." },
  ],
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function FinanceAssistant() {
  const ask = trpc.finance.ask.useMutation();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    try { const result = await ask.mutateAsync({ question }); setAnswer(result.answer); } catch { toast.error("Não foi possível consultar o assistente agora."); }
  };
  return <div className="panel-card mt-6"><div className="section-heading"><div><p className="eyebrow">assistente privado</p><h2 className="section-title">Pergunte aos seus dados</h2></div><WalletCards size={18} className="text-caveira-green" /></div><p className="text-sm leading-6 text-caveira-muted">A análise usa somente as transações registradas no CAVEIRA e informa quando faltarem dados.</p><form onSubmit={submit} className="mt-4 flex gap-2"><input className="field-input mt-0" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Onde estou gastando mais?" /><button className="button-primary shrink-0" disabled={ask.isPending || !question.trim()}>{ask.isPending ? "analisando" : "perguntar"}</button></form>{answer && <div className="mt-4 rounded-xl border border-caveira-border bg-caveira-panel-soft p-4 text-sm leading-6 text-caveira-text"><p className="eyebrow mb-2 text-caveira-green">resposta fundamentada</p>{answer}</div>}</div>;
}

function Shell({ module, children }: { module: string; children: React.ReactNode }) {
  const Icon = icons[module] ?? Activity;
  const meta = titles[module] ?? titles.habitos;
  return <div className="min-h-screen bg-caveira-bg text-caveira-text"><div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12"><div className="mb-6 flex items-center justify-between"><Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-caveira-muted transition hover:text-caveira-text"><ArrowLeft size={15} /> voltar ao painel</Link><Link href="/perfil" className="flex h-10 w-10 overflow-hidden rounded-xl border border-caveira-border transition hover:border-caveira-red"><img src="/caveira-photo-logo.png" alt="Abrir perfil" className="h-full w-full object-cover" /></Link></div><div className="mb-9 flex items-start gap-4"><div className="brand-mark mt-1 overflow-hidden p-0"><img src="/caveira-photo-logo.png" alt="Logo CAVEIRA" className="h-full w-full object-cover" /></div><div><p className="eyebrow text-caveira-red">{meta.eyebrow}</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.06em] sm:text-6xl">{meta.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-caveira-muted">{meta.description}</p></div></div>{children}{module === "financas" && <FinanceAssistant />}</div></div>;
}

function RecordWorkspace({ module }: { module: ModuleCode }) {
  const query = trpc.records.list.useQuery({ module }, { refetchOnWindowFocus: false });
  const create = trpc.records.create.useMutation({ onSuccess: () => query.refetch() });
  const update = trpc.records.update.useMutation({ onSuccess: () => query.refetch() });
  const remove = trpc.records.delete.useMutation({ onSuccess: () => query.refetch() });
  const fields = recordFields[module];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [amount, setAmount] = useState("");
  const [numericValue, setNumericValue] = useState("");
  const [details, setDetails] = useState<Details>({ type: module === "financas" ? "expense" : module === "alimentacao" ? "Café da manhã" : "" });

  const reset = () => { setEditingId(null); setTitle(""); setSubtitle(""); setDate(todayKey()); setAmount(""); setNumericValue(""); setDetails({ type: module === "financas" ? "expense" : module === "alimentacao" ? "Café da manhã" : "" }); };
  const edit = (record: NonNullable<typeof query.data>[number]) => { setEditingId(record.id); setTitle(record.title); setSubtitle(record.subtitle ?? ""); setDate(record.recordDate ?? todayKey()); setAmount(record.amountCents ? String(record.amountCents / 100) : ""); setNumericValue(String(record.numericValue || "")); setDetails(record.details as Details); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const numericDetails: Details = Object.fromEntries(Object.entries(details).map(([key, value]) => { const field = fields.find(item => item.key === key); return [key, field?.type === "number" ? Number(value || 0) : value]; }));
    const input = { module, title, subtitle: subtitle || undefined, status: module === "recompensas" ? "available" : "active", numericValue: module === "alimentacao" ? Number(numericValue || 0) : 0, amountCents: module === "financas" ? Math.round(Number(amount || 0) * 100) : module === "recompensas" ? Math.round(Number(details.costCents || 0) * 100) : 0, recordDate: date || null, details: numericDetails };
    try { if (editingId) await update.mutateAsync({ ...input, id: editingId }); else await create.mutateAsync(input); toast.success(editingId ? "Registro atualizado." : "Registro salvo."); reset(); } catch { toast.error("Não foi possível salvar o registro."); }
  };
  const totalIncome = useMemo(() => (query.data ?? []).filter(item => item.details.type === "income").reduce((sum, item) => sum + Math.abs(item.amountCents), 0), [query.data]);
  const totalExpenses = useMemo(() => (query.data ?? []).filter(item => item.details.type !== "income").reduce((sum, item) => sum + Math.abs(item.amountCents), 0), [query.data]);

  return <Shell module={module}><div className="grid gap-6 lg:grid-cols-[360px_1fr]"><form onSubmit={submit} className="panel-card h-fit space-y-4 lg:sticky lg:top-6"><div className="section-heading"><div><p className="eyebrow">{editingId ? "editar registro" : "novo registro"}</p><h2 className="section-title">{editingId ? "Ajustar lançamento" : "Registrar agora"}</h2></div>{editingId && <button type="button" onClick={reset} className="icon-button" aria-label="Cancelar edição"><X size={16} /></button>}</div><label className="field-label">Título<input className="field-input" value={title} onChange={event => setTitle(event.target.value)} placeholder={module === "treinos" ? "Supino reto" : module === "alimentacao" ? "Arroz, frango e legumes" : module === "financas" ? "Mercado da semana" : "Episódio da série"} /></label><label className="field-label">Contexto / observação<input className="field-input" value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="Opcional" /></label><label className="field-label">Data<input type="date" className="field-input" value={date} onChange={event => setDate(event.target.value)} /></label>{module === "alimentacao" && <label className="field-label">Calorias (estimativa)<input type="number" min="0" className="field-input" value={numericValue} onChange={event => setNumericValue(event.target.value)} placeholder="0" /></label>}{module === "financas" && <label className="field-label">Valor (R$)<input type="number" min="0" step="0.01" className="field-input" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" /></label>}{fields.map(field => <label key={field.key} className="field-label">{field.label}{field.type === "select" ? <select className="field-input" value={String(details[field.key] ?? field.options?.[0] ?? "")} onChange={event => setDetails(current => ({ ...current, [field.key]: event.target.value }))}>{field.options?.map(option => <option key={option} value={option}>{option === "expense" ? "Despesa" : option === "income" ? "Receita" : option}</option>)}</select> : <input type={field.type ?? "text"} min={field.type === "number" ? "0" : undefined} className="field-input" value={String(details[field.key] ?? "")} onChange={event => setDetails(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} />}</label>)}<button type="submit" disabled={create.isPending || update.isPending || !title.trim()} className="button-primary w-full"><Save size={15} /> {editingId ? "salvar alterações" : "salvar registro"}</button></form><div className="space-y-6"><div className="grid gap-3 sm:grid-cols-3"><div className="metric-card"><p className="metric-label">registros</p><p className="metric-value">{query.data?.length ?? 0}</p><p className="metric-detail">fonte persistente</p></div>{module === "financas" ? <><div className="metric-card"><p className="metric-label">receitas</p><p className="metric-value">{money(totalIncome)}</p><p className="metric-detail">neste recorte</p></div><div className="metric-card"><p className="metric-label">despesas</p><p className="metric-value">{money(totalExpenses)}</p><p className="metric-detail">neste recorte</p></div></> : <div className="metric-card"><p className="metric-label">último registro</p><p className="metric-value text-base">{query.data?.[0] ? formatDate(query.data[0].recordDate) : "—"}</p><p className="metric-detail">sem dados fictícios</p></div>}</div>{query.isLoading ? <div className="panel-card animate-pulse">Carregando registros...</div> : query.data?.length ? <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">histórico</p><h2 className="section-title">O que foi registrado</h2></div><span className="status-tag green">persistente</span></div><div className="space-y-2">{query.data.map(record => <div key={record.id} className="record-row"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-caveira-panel-soft text-caveira-muted">{module === "financas" ? <WalletCards size={17} /> : module === "alimentacao" ? <Utensils size={17} /> : module === "treinos" ? <Dumbbell size={17} /> : <Trophy size={17} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{record.title}</p><p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-caveira-muted">{record.subtitle || (module === "financas" ? (record.details.type === "income" ? "receita" : "despesa") : "registro") } · {formatDate(record.recordDate)}</p></div>{module === "financas" && <span className={`font-mono text-xs font-bold ${record.details.type === "income" ? "text-caveira-green" : "text-caveira-red"}`}>{record.details.type === "income" ? "+" : "-"}{money(record.amountCents)}</span>}{module === "alimentacao" && <span className="font-mono text-xs text-caveira-green">{record.numericValue} kcal</span>}<button onClick={() => edit(record)} className="icon-button" aria-label="Editar registro"><Pencil size={14} /></button><button onClick={() => { if (window.confirm("Excluir este registro? A alteração ficará no histórico.")) remove.mutate({ id: record.id }); }} className="icon-button text-caveira-red" aria-label="Excluir registro"><Trash2 size={14} /></button></div>)}</div></div> : <div className="panel-card"><div className="empty-state"><IconFor module={module} size={28} /><p className="mt-3 text-sm font-semibold">Ainda não há registros</p><p className="mt-2 max-w-sm text-center text-xs leading-5 text-caveira-muted">Comece pelo formulário. O CAVEIRA não preenche exemplos como se fossem seus.</p></div></div>}</div></div></Shell>;
}

function IconFor({ module, size = 24 }: { module: ModuleCode; size?: number }) { const Icon = icons[module]; return <Icon size={size} className="text-caveira-muted" />; }

function PhaseTwoWorkspace({ module }: { module: "habitos" | "tarefas" | "metas" }) {
  const today = useMemo(todayKey, []);
  const query = trpc.dashboard.snapshot.useQuery({ today }, { refetchOnWindowFocus: false });
  const createHabit = trpc.habits.create.useMutation({ onSuccess: () => query.refetch() });
  const toggleHabit = trpc.habits.toggleToday.useMutation({ onSuccess: () => query.refetch() });
  const deleteHabit = trpc.habits.delete.useMutation({ onSuccess: () => query.refetch() });
  const createTask = trpc.tasks.create.useMutation({ onSuccess: () => query.refetch() });
  const toggleTask = trpc.tasks.toggleComplete.useMutation({ onSuccess: () => query.refetch(), onError: error => toast.error(error.message) });
  const deleteTask = trpc.tasks.delete.useMutation({ onSuccess: () => query.refetch() });
  const createGoal = trpc.goals.create.useMutation({ onSuccess: () => query.refetch() });
  const updateGoal = trpc.goals.updateProgress.useMutation({ onSuccess: () => query.refetch() });
  const deleteGoal = trpc.goals.delete.useMutation({ onSuccess: () => query.refetch() });
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [deadline, setDeadline] = useState("");
  const [target, setTarget] = useState("100");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "custom">("daily");
  const [progress, setProgress] = useState<Record<number, string>>({});
  const meta = titles[module];
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; try { if (module === "habitos") await createHabit.mutateAsync({ name: title, category: category || undefined, frequency }); if (module === "tarefas") await createTask.mutateAsync({ title, category: category || undefined, priority, dueDate: deadline || null }); if (module === "metas") await createGoal.mutateAsync({ title, category: category || undefined, target: Number(target) || 100, deadline: deadline || null }); toast.success("Registro salvo."); setTitle(""); setCategory(""); setDeadline(""); } catch { toast.error("Não foi possível salvar."); } };
  return <Shell module={module}><div className="grid gap-6 lg:grid-cols-[350px_1fr]"><form onSubmit={submit} className="panel-card h-fit space-y-4 lg:sticky lg:top-6"><div className="section-heading"><div><p className="eyebrow">{meta.eyebrow}</p><h2 className="section-title">Adicionar</h2></div><Plus size={18} className="text-caveira-red" /></div><label className="field-label">{module === "habitos" ? "Nome do hábito" : module === "tarefas" ? "Título da tarefa" : "Nome da meta"}<input className="field-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Escreva um registro real" /></label><label className="field-label">Categoria<input className="field-input" value={category} onChange={event => setCategory(event.target.value)} placeholder="Opcional" /></label>{module === "habitos" && <label className="field-label">Frequência<select className="field-input" value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="custom">Dias específicos</option></select></label>}{module === "tarefas" && <><label className="field-label">Prioridade<select className="field-input" value={priority} onChange={event => setPriority(event.target.value as typeof priority)}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label><label className="field-label">Prazo<input type="date" className="field-input" value={deadline} onChange={event => setDeadline(event.target.value)} /></label></>}{module === "metas" && <><label className="field-label">Alvo mensurável<input type="number" min="1" className="field-input" value={target} onChange={event => setTarget(event.target.value)} /></label><label className="field-label">Prazo<input type="date" className="field-input" value={deadline} onChange={event => setDeadline(event.target.value)} /></label></>}<button className="button-primary w-full" disabled={!title.trim()}><Save size={15} /> salvar</button></form><div className="panel-card"><div className="section-heading"><div><p className="eyebrow">fonte persistente</p><h2 className="section-title">{module === "habitos" ? "Sua rotina" : module === "tarefas" ? "Fila de execução" : "Objetivos ativos"}</h2></div><span className="status-tag green">banco</span></div>{query.isLoading ? <p className="text-sm text-caveira-muted">Carregando...</p> : module === "habitos" ? <div className="space-y-2">{query.data?.habits.length ? query.data.habits.map(habit => <div key={habit.id} className="record-row"><button onClick={() => toggleHabit.mutate({ habitId: habit.id, day: today, completed: !habit.completedToday })} className={`check-button ${habit.completedToday ? "checked" : ""}`}>{habit.completedToday && <Check size={14} />}</button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{habit.name}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-caveira-muted">{habit.category} · {habit.frequency} · sequência {habit.streak}</p></div><button onClick={() => { if (window.confirm("Arquivar este hábito?")) deleteHabit.mutate({ habitId: habit.id }); }} className="icon-button text-caveira-red" aria-label="Arquivar hábito"><Trash2 size={14} /></button></div>) : <Empty label="Nenhum hábito ainda." />}</div> : module === "tarefas" ? <div className="space-y-2">{query.data?.tasks.length ? query.data.tasks.map(task => <div key={task.id} className="record-row"><button onClick={() => toggleTask.mutate({ taskId: task.id, completed: true, today })} className="check-button"><Check size={13} /></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-caveira-muted">{task.category} · prioridade {task.priority}{task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}</p></div><button onClick={() => { if (window.confirm("Excluir esta tarefa?")) deleteTask.mutate({ taskId: task.id }); }} className="icon-button text-caveira-red" aria-label="Excluir tarefa"><Trash2 size={14} /></button></div>) : <Empty label="Nenhuma tarefa aberta." />}</div> : <div className="space-y-4">{query.data?.goals.length ? query.data.goals.map(goal => { const percentage = Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100)); return <div key={goal.id} className="rounded-2xl border border-caveira-border p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{goal.title}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-caveira-muted">{goal.category} · {goal.progress}/{goal.target}</p></div><button onClick={() => { if (window.confirm("Excluir esta meta?")) deleteGoal.mutate({ goalId: goal.id }); }} className="icon-button text-caveira-red" aria-label="Excluir meta"><Trash2 size={14} /></button></div><div className="progress-track mt-4"><div className="progress-fill" style={{ width: `${percentage}%` }} /></div><div className="mt-3 flex gap-2"><input type="number" min="0" max={goal.target} value={progress[goal.id] ?? goal.progress} onChange={event => setProgress(current => ({ ...current, [goal.id]: event.target.value }))} className="field-input mt-0" /><button onClick={() => updateGoal.mutate({ goalId: goal.id, progress: Number(progress[goal.id] ?? goal.progress) })} className="button-secondary shrink-0"><Save size={14} /> atualizar</button></div></div>; }) : <Empty label="Nenhuma meta ainda." />}</div>}</div></div></Shell>;
}

function Empty({ label }: { label: string }) { return <div className="empty-state"><Target size={25} className="text-caveira-muted" /><p className="mt-3 text-sm font-semibold">{label}</p></div>; }

function FocusWorkspace() {
  const sessions = trpc.focus.sessions.useQuery(undefined, { refetchOnWindowFocus: false });
  const log = trpc.focus.log.useMutation({ onSuccess: () => sessions.refetch() });
  const [duration, setDuration] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setDuration(value => { if (value <= 1) { window.clearInterval(timer); setRunning(false); return 0; } return value - 1; }), 1000); return () => window.clearInterval(timer); }, [running]);
  const minutes = String(Math.floor(duration / 60)).padStart(2, "0"); const seconds = String(duration % 60).padStart(2, "0");
  const start = () => { setStartedAt(new Date().toISOString()); setRunning(true); };
  const stop = async () => { const endedAt = new Date(); const startDate = startedAt ? new Date(startedAt) : new Date(endedAt.getTime() - 25 * 60000); const elapsed = Math.max(1, Math.round((endedAt.getTime() - startDate.getTime()) / 60000)); try { await log.mutateAsync({ durationMinutes: elapsed, startedAt: startDate.toISOString(), endedAt: endedAt.toISOString() }); toast.success(`${elapsed} min registrados no foco.`); } catch { toast.error("Não foi possível registrar a sessão."); } setRunning(false); setStartedAt(null); setDuration(25 * 60); };
  return <Shell module="foco"><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel-card flex min-h-[470px] flex-col items-center justify-center text-center"><p className="eyebrow text-caveira-red">bloco atual</p><div className="my-8 font-mono text-8xl font-bold tracking-[-0.09em] sm:text-9xl">{minutes}:{seconds}</div><p className="max-w-sm text-sm leading-6 text-caveira-muted">Concentre-se em uma prioridade. Ao parar, o tempo efetivamente transcorrido é salvo no histórico.</p><div className="mt-8 flex flex-wrap justify-center gap-3">{!running ? <button onClick={start} className="button-primary"><Play size={16} /> iniciar</button> : <button onClick={() => setRunning(false)} className="button-secondary"><Pause size={16} /> pausar</button>}{startedAt && <button onClick={stop} className="button-secondary"><Check size={16} /> finalizar e salvar</button>}</div><div className="mt-8 flex items-center gap-2"><button onClick={() => { setRunning(false); setDuration(25 * 60); setStartedAt(null); }} className="text-xs font-bold uppercase tracking-[.14em] text-caveira-muted hover:text-caveira-text">Pomodoro 25</button><span className="text-caveira-border">/</span><button onClick={() => { setRunning(false); setDuration(50 * 60); setStartedAt(null); }} className="text-xs font-bold uppercase tracking-[.14em] text-caveira-muted hover:text-caveira-text">Bloco 50</button></div></div><div className="panel-card"><div className="section-heading"><div><p className="eyebrow">histórico</p><h2 className="section-title">Sessões salvas</h2></div><Clock3 size={18} className="text-caveira-muted" /></div>{sessions.data?.length ? <div className="space-y-2">{sessions.data.map(session => <div key={session.id} className="record-row"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-caveira-panel-soft text-caveira-green"><Timer size={15} /></div><div className="flex-1"><p className="text-sm font-semibold">{session.durationMinutes} minutos</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-caveira-muted">{formatDate(session.createdAt)}</p></div></div>)}</div> : <Empty label="Nenhuma sessão concluída." />}</div></div></Shell>;
}

function ReportsWorkspace() {
  const query = trpc.reports.summary.useQuery(undefined, { refetchOnWindowFocus: false });
  const data = query.data;
  return <Shell module="relatorios"><div className="space-y-6">{!data ? <div className="panel-card">Carregando relatório...</div> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="metric-card"><p className="metric-label">tarefas feitas</p><p className="metric-value">{data.counts.completedTasks}</p><p className="metric-detail">de {data.counts.tasks} cadastradas</p></div><div className="metric-card"><p className="metric-label">tempo de foco</p><p className="metric-value">{data.focusMinutes}m</p><p className="metric-detail">sessões registradas</p></div><div className="metric-card"><p className="metric-label">treinos</p><p className="metric-value">{data.counts.training}</p><p className="metric-detail">registros persistentes</p></div><div className="metric-card"><p className="metric-label">calorias hoje</p><p className="metric-value">{data.nutrition.caloriesToday}</p><p className="metric-detail">valor aproximado</p></div></div><div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><div className="panel-card"><p className="eyebrow">fechamento financeiro</p><h2 className="section-title">{data.period}</h2><div className="mt-6 space-y-4"><div className="flex justify-between text-sm"><span className="text-caveira-muted">Receitas</span><strong className="text-caveira-green">{money(data.finance.income)}</strong></div><div className="flex justify-between text-sm"><span className="text-caveira-muted">Despesas</span><strong className="text-caveira-red">{money(data.finance.expenses)}</strong></div><div className="border-t border-caveira-border pt-4"><div className="flex justify-between text-sm"><span className="text-caveira-muted">Saldo observado</span><strong>{money(data.finance.balance)}</strong></div></div></div></div><div className="panel-card"><p className="eyebrow">últimos registros</p><h2 className="section-title">Linha do tempo</h2><div className="mt-5 space-y-2">{data.records.slice(0, 7).map(record => <div key={`${record.module}-${record.id}`} className="record-row"><div className="flex-1"><p className="text-sm font-semibold">{record.title}</p><p className="mt-1 text-[10px] uppercase tracking-[.13em] text-caveira-muted">{record.module} · {formatDate(record.recordDate)}</p></div></div>)}</div></div></div><p className="text-xs leading-5 text-caveira-muted">Este relatório descreve registros observados. Ele não trata correlação como causalidade e não substitui acompanhamento profissional de saúde, produtividade ou finanças.</p></>}</div></Shell>;
}

function SettingsWorkspace() {
  const settings = trpc.settings.get.useQuery(undefined, { refetchOnWindowFocus: false });
  const save = trpc.settings.update.useMutation({ onSuccess: () => settings.refetch() });
  const backup = trpc.backup.export.useQuery(undefined, { enabled: false });
  const importRecords = trpc.backup.importRecords.useMutation({ onSuccess: result => toast.success(`${result.imported} registros importados.`) });
  const [notifications, setNotifications] = useState(true); const [focus, setFocus] = useState(25); const [breakTime, setBreakTime] = useState(5); const [goals, setGoals] = useState("");
  useEffect(() => { if (settings.data) { setNotifications(settings.data.notifications); setFocus(settings.data.preferredFocusMinutes); setBreakTime(settings.data.preferredBreakMinutes); setGoals(settings.data.goals ?? ""); } }, [settings.data]);
  const download = async () => { const result = await backup.refetch(); if (!result.data) return; const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `caveira-backup-${todayKey()}.json`; anchor.click(); URL.revokeObjectURL(url); toast.success("Backup exportado."); };
  const importFile = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if (!parsed.version || !Array.isArray(parsed.records)) throw new Error("invalid"); importRecords.mutate({ version: parsed.version, records: parsed.records }); } catch { toast.error("Backup inválido. Use um JSON exportado pelo CAVEIRA."); } }; reader.readAsText(file); };
  return <Shell module="configuracoes"><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><form onSubmit={event => { event.preventDefault(); save.mutate({ notifications, preferredFocusMinutes: focus, preferredBreakMinutes: breakTime, goals: goals || null }); }} className="panel-card space-y-5"><div className="section-heading"><div><p className="eyebrow">preferências</p><h2 className="section-title">Seu modo de operar</h2></div><Settings2 size={18} className="text-caveira-muted" /></div><label className="field-label">Objetivos pessoais<textarea className="field-input min-h-32 resize-y" value={goals} onChange={event => setGoals(event.target.value)} placeholder="O que você quer proteger e evoluir?" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="field-label">Foco padrão (min)<input type="number" min="1" max="120" className="field-input" value={focus} onChange={event => setFocus(Number(event.target.value))} /></label><label className="field-label">Pausa padrão (min)<input type="number" min="1" max="60" className="field-input" value={breakTime} onChange={event => setBreakTime(Number(event.target.value))} /></label></div><label className="flex items-center gap-3 rounded-xl border border-caveira-border p-3 text-sm"><input type="checkbox" checked={notifications} onChange={event => setNotifications(event.target.checked)} className="accent-red-500" /> receber lembretes locais quando disponíveis</label><button className="button-primary"><Save size={15} /> salvar preferências</button></form><div className="space-y-6"><div className="panel-card"><p className="eyebrow">segurança de dados</p><h2 className="section-title">Backup e restauração</h2><p className="mt-3 text-sm leading-6 text-caveira-muted">Exporte um JSON dos seus registros. A importação aceita apenas arquivos versionados com registros válidos.</p><button type="button" onClick={download} className="button-secondary mt-5 w-full"><Download size={15} /> exportar JSON</button><label className="button-secondary mt-2 w-full"><FileJson size={15} /> importar backup<input type="file" accept="application/json,.json" className="hidden" onChange={event => importFile(event.target.files?.[0])} /></label></div><div className="panel-card"><p className="eyebrow">escopo</p><h2 className="section-title">Privado por padrão</h2><p className="mt-3 text-sm leading-6 text-caveira-muted">O CAVEIRA não conecta banco, não envia transações para terceiros e mantém os registros vinculados à sua conta autenticada.</p></div></div></div></Shell>;
}

export default function ModulePage() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const [, params] = useRoute("/:module");
  const module = params?.module;
  if (loading || !isAuthenticated) return <div className="min-h-screen bg-caveira-bg" />;
  if (!module || !titles[module]) return <div className="min-h-screen bg-caveira-bg p-8 text-caveira-text">Módulo não encontrado.</div>;
  if (module === "habitos" || module === "tarefas" || module === "metas") return <PhaseTwoWorkspace module={module} />;
  if (module === "foco") return <FocusWorkspace />;
  if (module === "relatorios") return <ReportsWorkspace />;
  if (module === "configuracoes") return <SettingsWorkspace />;
  return <RecordWorkspace module={module as ModuleCode} />;
}
