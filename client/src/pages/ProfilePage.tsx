import { LogOut, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ProfilePage() {
  const { user, loading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });
  if (loading || !isAuthenticated || !user) return <div className="min-h-screen bg-caveira-bg" />;
  const initials = (user.name || "C").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const handleLogout = async () => {
    try { await logout(); toast.success("Sessão encerrada."); } catch { toast.error("Não foi possível encerrar a sessão."); }
  };
  return <main className="min-h-screen bg-caveira-bg px-5 py-8 text-caveira-text sm:px-8 lg:py-12">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-caveira-muted transition hover:text-caveira-text">← voltar ao painel</Link>
      <div className="mb-8 flex items-center gap-4"><div className="brand-mark overflow-hidden p-0"><img src="/caveira-photo-logo.png" alt="Caveira" className="h-full w-full object-cover" /></div><div><p className="eyebrow text-caveira-red">conta privada</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.06em] sm:text-6xl">Perfil</h1><p className="mt-3 text-sm text-caveira-muted">Sua identidade e sua sessão dentro do CAVEIRA.</p></div></div>
      <section className="panel-card overflow-hidden p-0"><div className="h-28 bg-[radial-gradient(circle_at_20%_20%,rgba(226,48,48,.32),transparent_42%),linear-gradient(120deg,#17171b,#09090b)]" /><div className="px-6 pb-6 sm:px-8"><div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-end gap-4"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-caveira-panel bg-caveira-panel-soft shadow-2xl"><img src="/caveira-photo-logo.png" alt="Avatar CAVEIRA" className="h-full w-full object-cover" /></div><div className="pb-1"><p className="font-display text-2xl font-extrabold">{user.name || "Operador"}</p><p className="mt-1 text-sm text-caveira-muted">{user.email || "Conta autenticada"}</p></div></div><span className="status-tag green self-start sm:self-auto"><ShieldCheck size={13} /> sessão ativa</span></div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-caveira-border bg-caveira-panel-soft p-4"><UserRound size={17} className="text-caveira-red" /><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-caveira-muted">identificador</p><p className="mt-1 truncate text-sm font-semibold">{user.openId}</p></div><div className="rounded-2xl border border-caveira-border bg-caveira-panel-soft p-4"><ShieldCheck size={17} className="text-caveira-green" /><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-caveira-muted">privacidade</p><p className="mt-1 text-sm font-semibold">Dados vinculados à sua conta</p></div></div>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/configuracoes" className="button-secondary"><Settings2 size={15} /> configurações</Link><button type="button" onClick={handleLogout} className="button-secondary text-caveira-red"><LogOut size={15} /> sair da conta</button></div>
      </div></section>
    </div>
  </main>;
}
