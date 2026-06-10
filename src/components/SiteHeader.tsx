import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, User, LogOut, Coins, Shield, CreditCard, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/auth.functions";

const nav = [
  { to: "/", label: "Home" },
  { to: "/resources", label: "Resources" },
  { to: "/categories", label: "Categories" },
  { to: "/membership", label: "Membership" },
  { to: "/leaderboard", label: "Leaderboard" },
] as const;

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ id: string } | null>(null);
  const navigate = useNavigate();
  const me = useServerFn(getMe);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user ? { id: data.user.id } : null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionUser(session?.user ? { id: session.user.id } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const meQuery = useQuery({
    queryKey: ["me", sessionUser?.id],
    queryFn: () => me(),
    enabled: !!sessionUser,
    staleTime: 30_000,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    navigate({ to: "/" });
  };

  const initials = (meQuery.data?.profile?.display_name || meQuery.data?.email || "U")
    .split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "glass-strong border-b border-border/50" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="transition-opacity hover:opacity-90"><Logo /></Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }} activeOptions={{ exact: n.to === "/" }}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {!sessionUser ? (
            <>
              <Link to="/auth" search={{ tab: "signin" }} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
              <Link to="/auth" search={{ tab: "signup" }} className="btn-glow hover:btn-glow-hover inline-flex items-center rounded-lg px-4 py-2 text-sm">Sign up</Link>
            </>
          ) : (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)}
                className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm hover:bg-secondary/40">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{initials}</span>
                <span className="hidden xl:inline text-foreground">{meQuery.data?.profile?.display_name ?? meQuery.data?.email}</span>
                <span className="inline-flex items-center gap-1 text-primary"><Coins size={12} />{meQuery.data?.profile?.credits_balance ?? 0}</span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="glass-strong absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border/60 p-2 shadow-2xl">
                    <div className="px-3 py-2">
                      <div className="text-sm font-medium text-foreground">{meQuery.data?.profile?.display_name ?? "Member"}</div>
                      <div className="truncate text-xs text-muted-foreground">{meQuery.data?.email}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        {meQuery.data?.isVip && <span className="rounded bg-primary/20 px-1.5 py-0.5 font-medium text-primary">VIP</span>}
                        {meQuery.data?.isAdmin && <span className="rounded bg-accent/20 px-1.5 py-0.5 font-medium text-accent">ADMIN</span>}
                        <span className="text-muted-foreground">{meQuery.data?.downloadsToday ?? 0} downloads today</span>
                      </div>
                    </div>
                    <div className="my-1 h-px bg-border/60" />
                    <MenuLink to="/account" icon={User} label="My Account" onClick={() => setMenuOpen(false)} />
                    <MenuLink to="/membership" icon={CreditCard} label="Membership" onClick={() => setMenuOpen(false)} />
                    <MenuLink to="/leaderboard" icon={Coins} label="Credits & Leaderboard" onClick={() => setMenuOpen(false)} />
                    {meQuery.data?.isAdmin && <MenuLink to="/admin" icon={Shield} label="Admin Dashboard" onClick={() => setMenuOpen(false)} />}
                    <div className="my-1 h-px bg-border/60" />
                    <button onClick={signOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button className="rounded-md p-2 text-muted-foreground hover:text-foreground lg:hidden"
          onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="glass-strong border-t border-border/50 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                activeProps={{ className: "text-foreground bg-secondary/40" }} activeOptions={{ exact: n.to === "/" }}>
                {n.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border/60" />
            {!sessionUser ? (
              <>
                <Link to="/auth" search={{ tab: "signin" }} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
                <Link to="/auth" search={{ tab: "signup" }} onClick={() => setOpen(false)} className="btn-glow mt-2 rounded-lg px-4 py-2.5 text-center text-sm">Sign up</Link>
              </>
            ) : (
              <>
                <Link to="/account" onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground">My Account ({meQuery.data?.profile?.credits_balance ?? 0} credits)</Link>
                {meQuery.data?.isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground">Admin</Link>}
                <button onClick={signOut} className="rounded-md px-3 py-3 text-left text-sm text-muted-foreground hover:text-foreground">Sign out</button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuLink({ to, icon: Icon, label, onClick }: { to: string; icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
      <Icon size={14} /> {label}
    </Link>
  );
}
