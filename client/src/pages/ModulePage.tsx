import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
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

const CATEGORY_OPTIONS = ["Alimentação", "Trabalho", "Estudos", "Financeiro", "Físico", "Saúde", "Desenvolvimento pessoal", "Hábitos", "Mente", "Relacionamentos", "Outros"];

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
  const pointsQuery = trpc.points.weekly.useQuery({ today: todayKey() }, { enabled: module === "recompensas", refetchOnWindowFocus: false });
  const redeem = trpc.records.redeem.useMutation({ onSuccess: () => { query.refetch(); pointsQuery.refetch(); toast.success("Recompensa resgatada."); }, onError: error => toast.error(error.message) });
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

  return <Shell module={module}>{module === "recompensas" && pointsQuery.data && <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="metric-card"><p className="metric-label">carteira disponível</p><p className="metric-value">{pointsQuery.data.walletBalance} pts</p><p className="metric-detail">saldo para resgates</p></div><div className="metric-card"><p className="metric-label">saldo semanal</p><p className="metric-value">{pointsQuery.data.net} pts</p><p className="metric-detail">ganhos menos perdas</p></div><div className="metric-card"><p className="metric-label">regra</p><p className="metric-value">+2 a +8</p><p className="metric-detail">por obrigação</p></div></div>}<div className="grid gap-6 lg:grid-cols-[360px_1fr]"><form onSubmit={submit} className="panel-card h-fit space-y-4 lg:sticky lg:top-6"><div className="section-heading"><div><p className="eyebrow">{editingId ? "editar registro" : "novo registro"}</p><h2 className="section-title">{editingId ? "Ajustar lançamento" : "Registrar agora"}</h2></div>{editingId && <button type="button" onClick={reset} className="icon-button" aria-label="Cancelar edição"><X size={16} /></button>}</div><label className="field-label">Título<input className="field-input" value={title} onChange={event => setTitle(event.target.value)} placeholder={module === "treinos" ? "Supino reto" : module === "alimentacao" ? "Arroz, frango e legumes" : module === "financas" ? "Mercado da semana" : "Episódio da série"} /></label><label className="field-label">Contexto / observação<input className="field-input" value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="Opcional" /></label><label className="field-label">Data<input type="date" className="field-input" value={date} onChange={event => setDate(event.target.value)} /></label>{module === "alimentacao" && <label className="field-label">Calorias (estimativa)<input type="number" min="0" className="field-input" value={numericValue} onChange={event => setNumericValue(event.target.value)} placeholder="0" /></label>}{module === "financas" && <label className="field-label">Valor (R$)<input type="number" min="0" step="0.01" className="field-input" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" /></label>}{fields.map(field => <label key={field.key} className="field-label">{field.label}{field.type === "select" ? <select className="field-input" value={String(details[field.key] ?? field.options?.[0] ?? "")} onChange={event => setDetails(current => ({ ...current, [field.key]: event.target.value }))}>{field.options?.map(option => <option key={option} value={option}>{option === "expense" ? "Despesa" : option === "income" ? "Receita" : option}</option>)}</select> : <input type={field.type ?? "text"} min={field.type === "number" ? "0" : undefined} className="field-input" value={String(details[field.key] ?? "")} onChange={event => setDetails(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} />}</label>)}<button type="submit" disabled={create.isPending || update.isPending || !title.trim()} className="button-primary w-full"><Save size={15} /> {editingId ? "salvar alterações" : "salvar registro"}</button></form><div className="space-y-6"><div className="grid gap-3 sm:grid-cols-3"><div className="metric-card"><p className="metric-label">registros</p><p className="metric-value">{query.data?.length ?? 0}</p><p className="metric-detail">fonte persistente</p></div>{module === "financas" ? <><div className="metric-card"><p className="metric-label">receitas</p><p className="metric-value">{money(totalIncome)}</p><p className="metric-detail">neste recorte</p></div><div className="metric-card"><p className="metric-label">despesas</p><p className="metric-value">{money(totalExpenses)}</p><p className="metric-detail">neste recorte</p></div></> : <div className="metric-card"><p className="metric-label">último registro</p><p className="metric-value text-base">{query.data?.[0] ? formatDate(query.data[0].recordDate) : "—"}</p><p className="metric-detail">sem dados fictícios</p></div>}</div>{query.isLoading ? <div className="panel-card animate-pulse">Carregando registros...</div> : query.data?.length ? <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">histórico</p><h2 className="section-title">O que foi registrado</h2></div><span className="status-tag green">persistente</span></div><div className="space-y-2">{query.data.map(record => <div key={record.id} className="record-row"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-caveira-panel-soft text-caveira-muted">{module === "financas" ? <WalletCards size={17} /> : module === "alimentacao" ? <Utensils size={17} /> : module === "treinos" ? <Dumbbell size={17} /> : <Trophy size={17} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{record.title}</p><p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-caveira-muted">{record.subtitle || (module === "financas" ? (record.details.type === "income" ? "receita" : "despesa") : "registro") } · {formatDate(record.recordDate)}</p></div>{module === "financas" && <span className={`font-mono text-xs font-bold ${record.details.type === "income" ? "text-caveira-green" : "text-caveira-red"}`}>{record.details.type === "income" ? "+" : "-"}{money(record.amountCents)}</span>}{module === "alimentacao" && <span className="font-mono text-xs text-caveira-green">{record.numericValue} kcal</span>}{module === "recompensas" && <><span className="font-mono text-xs text-caveira-green">{Number(record.details.pointsRequired || 0)} pts</span>{record.status !== "redeemed" && <button onClick={() => { const cost = Number(record.details.pointsRequired || 0); if (!cost) return toast.error("Defina o custo em pontos antes de resgatar."); if ((pointsQuery.data?.walletBalance ?? 0) < cost) return toast.error("Pontos insuficientes para esta recompensa."); redeem.mutate({ id: record.id, points: cost }); }} className="button-secondary px-2 py-1 text-[10px]">resgatar</button>}</>}<button onClick={() => edit(record)} className="icon-button" aria-label="Editar registro"><Pencil size={14} /></button><button onClick={() => { if (window.confirm("Excluir este registro? A alteração ficará no histórico.")) remove.mutate({ id: record.id }); }} className="icon-button text-caveira-red" aria-label="Excluir registro"><Trash2 size={14} /></button></div>)}</div></div> : <div className="panel-card"><div className="empty-state"><IconFor module={module} size={28} /><p className="mt-3 text-sm font-semibold">Ainda não há registros</p><p className="mt-2 max-w-sm text-center text-xs leading-5 text-caveira-muted">Comece pelo formulário. O CAVEIRA não preenche exemplos como se fossem seus.</p></div></div>}</div></div></Shell>;
}

function IconFor({ module, size = 24 }: { module: ModuleCode; size?: number }) { const Icon = icons[module]; return <Icon size={size} className="text-caveira-muted" />; }

const goalVisuals = {
  physical: "/manus-storage/async-images/ffqo7DU0uOQADxrV9HONoc/image-1.webp",
  motorcycle: "/manus-storage/async-images/ffqo7DU0uOQADxrV9HONoc/image-2.webp",
  nutrition: "/manus-storage/async-images/ffqo7DU0uOQADxrV9HONoc/image-3.webp",
  study: "/manus-storage/async-images/ffqo7DU0uOQADxrV9HONoc/image-4.webp",
  career: "/manus-storage/async-images/ffqo7DU0uOQADxrV9HONoc/image-5.webp",
} as const;

function visualForGoal(title: string, category?: string | null) {
  const value = `${title} ${category ?? ""}`.toLowerCase();
  if (/moto|motocic|veículo/.test(value)) return { image: goalVisuals.motorcycle, tone: "goal-visual-red" };
  if (/aliment|nutri|dieta|comida|saúde/.test(value)) return { image: goalVisuals.nutrition, tone: "goal-visual-warm" };
  if (/estud|curso|livro|prova|mente/.test(value)) return { image: goalVisuals.study, tone: "goal-visual-purple" };
  if (/trabalho|carreira|profiss|negócio|finance/.test(value)) return { image: goalVisuals.career, tone: "goal-visual-red" };
  if (/físic|trein|corpo|academ|força/.test(value)) return { image: goalVisuals.physical, tone: "goal-visual-green" };
  return { image: goalVisuals.career, tone: "goal-visual-green" };
}

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
  const deleteGoal = trpc.goals.delete.useMutation({ onSuccess: () => query.refetch() });
  const [tab, setTab] = useState<"overview" | "create">("overview");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [target, setTarget] = useState("100");
  const [automationType, setAutomationType] = useState<"habit" | "tasks" | "focus" | "training" | "nutrition">("tasks");
  const [automationRefId, setAutomationRefId] = useState("");
  const [taskGoalId, setTaskGoalId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "custom">("daily");
  const meta = titles[module];
  const selectedCategoryPoints = category ? ({ "Alimentação": 8, "Trabalho": 7, "Estudos": 6, "Financeiro": 6, "Físico": 5, "Saúde": 5, "Desenvolvimento pessoal": 5, "Hábitos": 4, "Mente": 4, "Relacionamentos": 4, "Outros": 3 } as Record<string, number>)[category] ?? 3 : 0;

  const resetForm = () => { setTitle(""); setCategory(""); setDeadline(""); setTarget("100"); setTaskGoalId(""); setAutomationType("tasks"); setAutomationRefId(""); setFrequency("daily"); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      if (module === "habitos") await createHabit.mutateAsync({ name: title, category: category || undefined, frequency });
      if (module === "tarefas") await createTask.mutateAsync({ title, category: category || undefined, dueDate: deadline || null, goalId: taskGoalId ? Number(taskGoalId) : null });
      if (module === "metas") {
        if (automationType === "habit" && !automationRefId) return toast.error("Escolha qual hábito alimentará esta meta.");
        await createGoal.mutateAsync({ title, category: category || undefined, target: Number(target) || 100, deadline: deadline || null, automationType, automationRefId: automationType === "habit" ? Number(automationRefId) : null });
      }
      toast.success("Registro salvo.");
      resetForm();
      setTab("overview");
    } catch { toast.error("Não foi possível salvar."); }
  };

  const categoryOptions = CATEGORY_OPTIONS;
  const overviewTitle = module === "habitos" ? "Visão geral da rotina" : module === "tarefas" ? "Visão geral do dia" : "Visão geral das metas";
  return <Shell module={module}>
    <div className="module-tabs" role="tablist" aria-label={`Navegação de ${meta.title}`}>
      <button role="tab" aria-selected={tab === "overview"} onClick={() => setTab("overview")} className={`module-tab ${tab === "overview" ? "active" : ""}`}><BarChart3 size={15} /> visão geral</button>
      <button role="tab" aria-selected={tab === "create"} onClick={() => setTab("create")} className={`module-tab ${tab === "create" ? "active" : ""}`}><Plus size={15} /> criação</button>
    </div>

    {tab === "create" ? <form id="phase-two-form" onSubmit={submit} className="panel-card mx-auto max-w-3xl space-y-5"><div className="section-heading"><div><p className="eyebrow text-caveira-red">novo registro</p><h2 className="section-title">Construir {module === "habitos" ? "hábito" : module === "tarefas" ? "tarefa" : "meta"}</h2></div><Save size={18} className="text-caveira-red" /></div><label className="field-label">{module === "habitos" ? "Nome do hábito" : module === "tarefas" ? "Título da tarefa" : "Nome da meta"}<input className="field-input" value={title} onChange={event => setTitle(event.target.value)} placeholder={module === "tarefas" ? "Ex.: revisar o planejamento da semana" : "Escreva um registro real"} autoFocus /></label><label className="field-label">Categoria<select className="field-input" value={category} onChange={event => setCategory(event.target.value)}><option value="">Escolha uma categoria</option>{categoryOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>{module === "tarefas" && <div className="rounded-2xl border border-caveira-border bg-caveira-panel-soft p-4"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">valor da execução</p><p className="mt-2 text-sm font-semibold">Pontuação definida pela categoria</p></div><span className="font-mono text-2xl font-bold text-caveira-green">+{selectedCategoryPoints || "—"}</span></div><p className="mt-2 text-xs leading-5 text-caveira-muted">Alimentação e Trabalho exigem mais pontos; atividades da mesma categoria no mesmo dia não duplicam o saldo.</p></div>}{module === "habitos" && <label className="field-label">Frequência<select className="field-input" value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="custom">Dias específicos</option></select></label>}{module === "tarefas" && <><label className="field-label">Prazo<input type="date" className="field-input" value={deadline} onChange={event => setDeadline(event.target.value)} /></label><label className="field-label">Meta vinculada<select className="field-input" value={taskGoalId} onChange={event => setTaskGoalId(event.target.value)}><option value="">Nenhuma</option>{query.data?.goals.filter(goal => goal.automationType === "tasks").map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label></>}{module === "metas" && <><label className="field-label">Alvo mensurável<input type="number" min="1" className="field-input" value={target} onChange={event => setTarget(event.target.value)} /></label><label className="field-label">Prazo<input type="date" className="field-input" value={deadline} onChange={event => setDeadline(event.target.value)} /></label><label className="field-label">Fonte automática<select className="field-input" value={automationType} onChange={event => { setAutomationType(event.target.value as typeof automationType); setAutomationRefId(""); }}><option value="tasks">Tarefas concluídas</option><option value="habit">Conclusões de um hábito</option><option value="focus">Minutos de foco</option><option value="training">Registros de treino</option><option value="nutrition">Registros de alimentação</option></select></label>{automationType === "habit" && <label className="field-label">Hábito vinculado<select className="field-input" value={automationRefId} onChange={event => setAutomationRefId(event.target.value)}><option value="">Escolha um hábito</option>{query.data?.habits.map(habit => <option key={habit.id} value={habit.id}>{habit.name}</option>)}</select></label>}<div className="rounded-2xl border border-caveira-green/20 bg-caveira-green/5 p-4 text-xs leading-5 text-caveira-muted"><span className="font-bold text-caveira-green">Acompanhamento automático ativo.</span> O progresso será calculado no servidor a partir de tarefas, hábitos ou registros reais. Não existe progresso digitado para metas novas.</div></>}</form> : null}
    {tab === "create" && <div className="mx-auto mt-4 flex max-w-3xl justify-end gap-3"><button type="button" onClick={() => { resetForm(); setTab("overview"); }} className="button-secondary">cancelar</button><button type="submit" form="phase-two-form" className="button-primary" disabled={!title.trim()}><Save size={15} /> salvar {module === "metas" ? "meta automática" : module === "tarefas" ? "tarefa" : "hábito"}</button></div>}

    {tab === "overview" && <div className="space-y-6"><div className="section-heading"><div><p className="eyebrow">dados persistentes · {today}</p><h2 className="section-title">{overviewTitle}</h2></div><button onClick={() => setTab("create")} className="button-primary"><Plus size={15} /> criar novo</button></div>{query.isLoading ? <div className="panel-card">Carregando dados reais...</div> : module === "habitos" ? <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-3"><div className="metric-card"><p className="metric-label">hábitos ativos</p><p className="metric-value">{query.data?.counts.habits ?? 0}</p><p className="metric-detail">na sua rotina</p></div><div className="metric-card"><p className="metric-label">concluídos hoje</p><p className="metric-value">{query.data?.counts.completedHabitsToday ?? 0}</p><p className="metric-detail">registro real</p></div><div className="metric-card"><p className="metric-label">melhor sequência</p><p className="metric-value">{query.data?.streak ?? 0}d</p><p className="metric-detail">consistência atual</p></div></div><div className="panel-card"><div className="section-heading"><div><p className="eyebrow">ritual de hoje</p><h3 className="section-title">Hábitos em campo</h3></div><span className="status-tag green">{query.data?.counts.completedHabitsToday ?? 0}/{query.data?.counts.habits ?? 0}</span></div>{query.data?.habits.length ? <div className="space-y-2">{query.data.habits.map(habit => <div key={habit.id} className={`record-row ${habit.completedToday ? "record-complete" : ""}`}><button onClick={() => toggleHabit.mutate({ habitId: habit.id, day: today, completed: !habit.completedToday })} className={`check-button ${habit.completedToday ? "checked" : ""}`} aria-label={habit.completedToday ? "Desmarcar hábito" : "Concluir hábito"}>{habit.completedToday && <Check size={14} />}</button><div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${habit.completedToday ? "line-through opacity-60" : ""}`}>{habit.name}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-caveira-muted">{habit.category} · {habit.streak} dias · {habit.frequency === "daily" ? "diário" : "semanal"}</p></div><button onClick={() => { if (window.confirm("Arquivar este hábito?")) deleteHabit.mutate({ habitId: habit.id }); }} className="icon-button text-caveira-red" aria-label="Arquivar hábito"><Trash2 size={14} /></button></div>)}</div> : <Empty label="Nenhum hábito ainda." />}</div></div> : module === "tarefas" ? <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-4"><div className="metric-card"><p className="metric-label">tarefas do dia</p><p className="metric-value">{query.data?.taskInsights.todayTotal ?? 0}</p><p className="metric-detail">criadas ou com prazo hoje</p></div><div className="metric-card"><p className="metric-label">cumpridas</p><p className="metric-value">{query.data?.taskInsights.todayCompleted ?? 0}</p><p className="metric-detail">desempenho de hoje</p></div><div className="metric-card"><p className="metric-label">constância</p><p className="metric-value">{query.data?.taskInsights.strongestCategory ?? "—"}</p><p className="metric-detail">melhor categoria</p></div><div className="metric-card"><p className="metric-label">atenção</p><p className="metric-value">{query.data?.taskInsights.difficultCategory ?? "—"}</p><p className="metric-detail">menor cumprimento</p></div></div><div className="panel-card"><div className="section-heading"><div><p className="eyebrow">fila de hoje</p><h3 className="section-title">O que precisa acontecer</h3></div><span className="status-tag green">pontos por categoria</span></div>{query.data?.todayTasks.length ? <div className="space-y-2">{query.data.todayTasks.map(task => <div key={task.id} className={`record-row ${task.status === "completed" ? "record-complete" : ""}`}><button onClick={() => task.status !== "completed" && toggleTask.mutate({ taskId: task.id, completed: true, today })} className={`check-button ${task.status === "completed" ? "checked" : ""}`} aria-label={task.status === "completed" ? "Tarefa concluída" : "Concluir tarefa"}>{task.status === "completed" && <Check size={13} />}</button><div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${task.status === "completed" ? "line-through opacity-60" : ""}`}>{task.title}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-caveira-muted">{task.category} · +{({ "Alimentação": 8, "Trabalho": 7, "Estudos": 6, "Financeiro": 6, "Físico": 5, "Saúde": 5, "Desenvolvimento pessoal": 5, "Hábitos": 4, "Mente": 4, "Relacionamentos": 4, "Outros": 3 } as Record<string, number>)[task.category] ?? 3} pts{task.dueDate ? ` · prazo ${formatDate(task.dueDate)}` : ""}</p></div><button onClick={() => { if (window.confirm("Excluir esta tarefa?")) deleteTask.mutate({ taskId: task.id }); }} className="icon-button text-caveira-red" aria-label="Excluir tarefa"><Trash2 size={14} /></button></div>)}</div> : <Empty label="Nenhuma tarefa planejada para hoje." />}</div><div className="panel-card"><div className="section-heading"><div><p className="eyebrow">leitura da consistência</p><h3 className="section-title">Onde você rende melhor</h3></div></div>{query.data?.taskInsights.categoryStats.length ? <div className="grid gap-3 sm:grid-cols-2">{query.data.taskInsights.categoryStats.map(item => <div key={item.category} className="rounded-2xl border border-caveira-border bg-caveira-panel-soft p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{item.category}</span><span className="font-mono text-sm text-caveira-green">{item.rate}%</span></div><div className="progress-track mt-3"><div className="progress-fill" style={{ width: `${item.rate}%` }} /></div><p className="mt-2 text-[11px] text-caveira-muted">{item.completed}/{item.total} tarefas · {item.points} pts por tarefa</p></div>)}</div> : <Empty label="Conclua tarefas para formar seu histórico de constância." />}</div></div> : <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-3"><div className="metric-card"><p className="metric-label">metas ativas</p><p className="metric-value">{query.data?.goals.filter(goal => goal.computedStatus !== "completed").length ?? 0}</p><p className="metric-detail">em acompanhamento</p></div><div className="metric-card"><p className="metric-label">concluídas</p><p className="metric-value">{query.data?.goals.filter(goal => goal.computedStatus === "completed").length ?? 0}</p><p className="metric-detail">por registros reais</p></div><div className="metric-card"><p className="metric-label">automação</p><p className="metric-value">100%</p><p className="metric-detail">metas novas</p></div></div><div className="goal-card-grid">{query.data?.goals.length ? query.data.goals.map(goal => { const percentage = Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100)); const visual = visualForGoal(goal.title, goal.category); return <article key={goal.id} className="goal-card"><div className={`goal-visual ${visual.tone}`}><img className="goal-image" src={visual.image} alt="" /><span>{goal.category}</span></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-extrabold tracking-[-.03em]">{goal.title}</h3><p className="mt-1 text-xs text-caveira-muted">{goal.progress}/{goal.target} · {goal.automationType === "manual" ? "legado manual" : "acompanhamento automático"}</p></div><button onClick={() => { if (window.confirm("Excluir esta meta?")) deleteGoal.mutate({ goalId: goal.id }); }} className="icon-button text-caveira-red" aria-label="Excluir meta"><Trash2 size={14} /></button></div><div className="progress-track mt-4"><div className="progress-fill" style={{ width: `${percentage}%` }} /></div><div className="mt-3 flex items-center justify-between gap-2"><span className="font-mono text-xs text-caveira-green">{percentage}%</span>{goal.isOverdue && <span className="status-tag red">atrasada</span>}{goal.computedStatus === "completed" && <span className="status-tag green">concluída</span>}</div></div></article>; }) : <Empty label="Nenhuma meta ainda." />}</div></div>}</div>}
  </Shell>
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

function ReportMetric({ label, value, detail, icon: Icon, accent = "default" }: { label: string; value: string | number; detail: string; icon: LucideIcon; accent?: "default" | "red" | "green" }) { return <div className="metric-card"><div className={`metric-icon ${accent}`}><Icon size={17} /></div><div><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">{detail}</p></div></div>; }

function MonthlyLineChart({ points }: { points: Array<{ day: string; points: number }> }) {
  const values = points.map(point => point.points);
  const max = Math.max(...values, 1);
  const width = 720;
  const height = 210;
  const chart = points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * width},${height - (point.points / max) * 165 - 15}`).join(" ");
  return <div className="overflow-hidden rounded-2xl border border-caveira-border bg-caveira-panel-soft p-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Evolução diária do mês"><line x1="0" y1="195" x2={width} y2="195" stroke="#29292f" /><line x1="0" y1="112" x2={width} y2="112" stroke="#29292f" strokeDasharray="4 8" /><polyline fill="none" stroke="#e53935" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={chart} />{points.map((point, index) => <circle key={point.day} cx={(index / Math.max(points.length - 1, 1)) * width} cy={height - (point.points / max) * 165 - 15} r="4" fill="#b7f36b" />)}</svg><div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-[.12em] text-caveira-muted"><span>dia 01</span><span>picos e baixas do mês</span><span>dia {String(points.length).padStart(2, "0")}</span></div></div>;
}

function ReportsWorkspace() {
  const query = trpc.reports.summary.useQuery(undefined, { refetchOnWindowFocus: false });
  const points = trpc.points.weekly.useQuery({ today: todayKey() }, { refetchOnWindowFocus: false });
  const monthly = trpc.reports.monthly.useQuery(undefined, { refetchOnWindowFocus: false });
  const [view, setView] = useState<"daily" | "monthly">("daily");
  const data = query.data;
  const month = monthly.data;
  return <Shell module="relatorios"><div className="space-y-6"><div className="module-tabs" role="tablist" aria-label="Período do relatório"><button role="tab" aria-selected={view === "daily"} onClick={() => setView("daily")} className={`module-tab ${view === "daily" ? "active" : ""}`}><BarChart3 size={15} /> diário</button><button role="tab" aria-selected={view === "monthly"} onClick={() => setView("monthly")} className={`module-tab ${view === "monthly" ? "active" : ""}`}><CalendarDays size={15} /> mensal</button></div>{view === "daily" ? !data || !points.data ? <div className="panel-card">Carregando relatório...</div> : <section className="panel-card"><div className="section-heading"><div><p className="eyebrow text-caveira-red">fechamento semanal</p><h2 className="section-title">{points.data.net} pontos líquidos</h2></div><span className="status-tag green">carteira {points.data.walletBalance} pts</span></div><div className="grid grid-cols-2 gap-3"><ReportMetric label="ganhos" value={`+${points.data.earned}`} detail="ações cumpridas" icon={Check} accent="green" /><ReportMetric label="perdas" value={`-${points.data.lost}`} detail="falhas e prazos" icon={X} accent="red" /><ReportMetric label="cumprimento" value={`${points.data.completionRate}%`} detail="obrigações" icon={Target} /><ReportMetric label="tarefas feitas" value={data.counts.completedTasks} detail={`de ${data.counts.tasks} cadastradas`} icon={Check} accent="green" /></div><p className="mt-4 text-xs leading-5 text-caveira-muted">Semana de {points.data.start} a {points.data.today}. As regras são fixas e transparentes; nenhuma ação gera milhares de pontos.</p></section> : !month ? <div className="panel-card">Carregando fechamento mensal...</div> : !month.hasData ? <div className="panel-card"><div className="empty-state"><CalendarDays size={28} /><p className="mt-3 text-sm font-semibold">Ainda não há dados para fechar este mês</p><p className="mt-2 max-w-sm text-xs leading-5 text-caveira-muted">Registre hábitos, tarefas, metas acompanhadas ou treinos. O CAVEIRA não preencherá lacunas com números inventados.</p></div></div> : <div className="space-y-4"><section className="panel-card"><div className="section-heading"><div><p className="eyebrow text-caveira-red">resumo do mês</p><h2 className="section-title">Fechamento de {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${month.month}-01T12:00:00`))}</h2></div><CalendarDays size={18} className="text-caveira-red" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><ReportMetric label="consistência" value={`${month.summary.consistency}%`} detail="dias ativos no ciclo" icon={Flame} accent="green" /><ReportMetric label="dias ativos" value={month.summary.activeDays} detail="com algum registro" icon={CalendarDays} /><ReportMetric label="tarefas concluídas" value={month.summary.completedTasks} detail="no mês" icon={Check} accent="green" /><ReportMetric label="metas acompanhadas" value={month.summary.accompaniedGoals} detail="com atividade no mês" icon={Target} /></div></section><details className="panel-card" open><summary className="cursor-pointer list-none"><p className="eyebrow">evolução</p><h2 className="section-title">Altos e baixos do mês</h2><p className="mt-2 text-xs text-caveira-muted">Pontos observados por dia, sem suavizar os dias sem atividade.</p></summary><div className="mt-5"><MonthlyLineChart points={month.daily} /></div></details><details className="panel-card" open><summary className="cursor-pointer list-none"><p className="eyebrow">desempenho por área</p><h2 className="section-title">Onde a energia apareceu</h2><p className="mt-2 text-xs text-caveira-muted">Somente categorias que tiveram registros neste mês.</p></summary><div className="mt-5 space-y-3">{month.areas.map(area => <div key={area.category} className="rounded-2xl border border-caveira-border bg-caveira-panel-soft p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{area.category}</span><span className="font-mono text-sm text-caveira-green">{area.rate}%</span></div><div className="progress-track mt-3"><div className="progress-fill" style={{ width: `${area.rate}%` }} /></div><p className="mt-2 text-[11px] text-caveira-muted">{area.completed} concluídos de {area.total} registrados</p></div>)}</div></details><details className="panel-card" open><summary className="cursor-pointer list-none"><p className="eyebrow">análise do mês</p><h2 className="section-title">O que ajustar no próximo ciclo</h2></summary><div className="mt-5 space-y-3">{month.analysis?.bestArea && <p className="rounded-xl border border-caveira-green/20 bg-caveira-green/5 p-3 text-sm leading-6"><strong className="text-caveira-green">Melhor resultado:</strong> {month.analysis.bestArea}</p>}{month.analysis?.attentionArea && <p className="rounded-xl border border-caveira-red/20 bg-caveira-red/5 p-3 text-sm leading-6"><strong className="text-caveira-red">Ponto de atenção:</strong> {month.analysis.attentionArea}</p>}{month.analysis?.suggestions.map(suggestion => <p key={suggestion} className="border-l-2 border-caveira-border pl-3 text-sm leading-6 text-caveira-muted">{suggestion}</p>)}</div></details></div>}</div></Shell>;
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
