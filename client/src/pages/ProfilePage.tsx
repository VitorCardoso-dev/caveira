import { Activity, BarChart3, Dumbbell, Home, ListTodo, LogOut, Settings2, ShieldCheck, Target, Trophy, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";


const profileNavigation = [
  { label: "Painel", href: "/", icon: Home },
  { label: "Hábitos", href: "/habitos", icon: Activity },
  { label: "Tarefas", href: "/tarefas", icon: ListTodo },
  { label: "Metas", href: "/metas", icon: Target },
  { label: "Treinos", href: "/treinos", icon: Dumbbell },
  { label: "Recompensas", href: "/recompensas", icon: Trophy },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Perfil", href: "/perfil", icon: UserRound },
];

function ProfileBottomNavigation() {
  const [location] = useLocation();
  return <div className="mobile-bottom-nav fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-caveira-border bg-caveira-panel/95 p-2 shadow-2xl backdrop-blur lg:hidden">
    <nav aria-label="Navegação principal" className="flex items-center justify-around">
      {profileNavigation.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`mobile-nav-item ${location === item.href ? "active" : ""}`}><Icon size={16} /><span>{item.label}</span></Link>; })}
    </nav>
  </div>;
}

export default function ProfilePage() {
  const { user, loading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });
  if (loading || !isAuthenticated || !user) return <div className="min-h-screen bg-caveira-bg" />;
  const initials = (user.name || "C").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const handleLogout = async () => {
    try { await logout(); toast.success("Sessão encerrada."); } catch { toast.error("Não foi possível encerrar a sessão."); }
  };
  return <div className="page-enter min-h-screen bg-caveira-bg px-5 py-6 pb-32 text-caveira-text sm:px-8 lg:py-10">
    <div className="mx-auto max-w-3xl">

      <div className="mb-8 flex items-center gap-4"><div className="brand-mark overflow-hidden p-0"><img src="/methamorphis-mark.svg" alt="Methamorphis" className="h-full w-full object-cover" /></div><div><p className="eyebrow text-caveira-green">conta privada</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.06em] sm:text-6xl">Perfil</h1><p className="mt-3 text-sm text-caveira-muted">Sua identidade e sua sessão dentro do Methamorphis.</p></div></div>
      <section className="panel-card overflow-hidden p-0"><div className="h-28 bg-[radial-gradient(circle_at_20%_20%,rgba(134,239,172,.24),transparent_42%),linear-gradient(120deg,#17171b,#09090b)]" /><div className="px-6 pb-6 sm:px-8"><div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-end gap-4"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-caveira-panel bg-caveira-panel-soft shadow-2xl"><img src="/methamorphis-mark.svg" alt="Avatar Methamorphis" className="h-full w-full object-cover" /></div><div className="pb-1"><p className="font-display text-2xl font-extrabold">{user.name || "Operador"}</p><p className="mt-1 text-sm text-caveira-muted">{user.email || "Conta autenticada"}</p></div></div><span className="status-tag green self-start sm:self-auto"><ShieldCheck size={13} /> sessão ativa</span></div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-caveira-border bg-caveira-panel-soft p-4"><UserRound size={17} className="text-caveira-red" /><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-caveira-muted">identificador</p><p className="mt-1 truncate text-sm font-semibold">{user.openId}</p></div><div className="rounded-2xl border border-caveira-border bg-caveira-panel-soft p-4"><ShieldCheck size={17} className="text-caveira-green" /><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-caveira-muted">privacidade</p><p className="mt-1 text-sm font-semibold">Dados vinculados à sua conta</p></div></div>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/configuracoes" className="button-secondary"><Settings2 size={15} /> configurações</Link><button type="button" onClick={handleLogout} className="button-secondary text-caveira-red"><LogOut size={15} /> sair da conta</button></div>
      </div></section>
    </div>
    <ProfileBottomNavigation />
  </div>;
}
