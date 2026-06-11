import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Save, Upload, Settings as Cog, FolderTree, Package, Users as UsersIcon, Crown, Receipt, Coins, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { RichTextEditor } from "@/components/RichTextEditor";
import { listCategories } from "@/lib/resources.functions";
import {
  adminCheck, adminListResources, adminSaveResource, adminDeleteResource,
  adminSaveCategory, adminDeleteCategory, adminSaveSettings, adminUploadUrl, adminPromoteSelf,
} from "@/lib/admin.functions";
import {
  adminListUsers, adminGrantRole, adminAdjustCredits,
  adminListPlans, adminSavePlan, adminDeletePlan,
  adminListReceipts, adminApproveReceipt, adminRejectReceipt,
  adminListMemberships, adminBulkUpdateTier,
} from "@/lib/admin-ext.functions";
import { getSettings } from "@/lib/resources.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Cubyn Spigot" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Tab = "resources" | "categories" | "users" | "plans" | "payments" | "memberships" | "settings";


function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("resources");

  const check = useServerFn(adminCheck);
  const promote = useServerFn(adminPromoteSelf);
  const status = useQuery({ queryKey: ["admin-check"], queryFn: () => check() });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { tab: "signin" }, replace: true });
  };

  if (status.isLoading) return <FullPage>Loading…</FullPage>;
  if (!status.data?.isAdmin) {
    return (
      <FullPage>
        <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center">
          <Logo size={36} />
          <h1 className="mt-6 font-display text-xl font-bold">Not an admin yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">If you're the first user, claim the admin role now.</p>
          <button onClick={async () => { try { await promote(); toast.success("You're now an admin"); status.refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}
            className="btn-glow hover:btn-glow-hover mt-6 w-full rounded-lg px-4 py-2.5 text-sm">
            Claim admin role
          </button>
          <button onClick={signOut} className="mt-3 w-full text-xs text-muted-foreground hover:text-primary">Sign out</button>
        </div>
      </FullPage>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="glass-strong sticky top-0 z-40 border-b border-border/50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">View site</Link>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-bold">Admin <span className="text-gradient">Dashboard</span></h1>

        <div className="glass mt-6 inline-flex flex-wrap gap-1 rounded-xl p-1">
          {[
            { id: "resources" as const, icon: Package, label: "Resources" },
            { id: "categories" as const, icon: FolderTree, label: "Categories" },
            { id: "users" as const, icon: UsersIcon, label: "Users" },
            { id: "plans" as const, icon: Crown, label: "Plans" },
            { id: "payments" as const, icon: Receipt, label: "Payments" },
            { id: "memberships" as const, icon: Crown, label: "Memberships" },
            { id: "settings" as const, icon: Cog, label: "Settings" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${tab === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "resources" && <ResourcesTab />}
          {tab === "categories" && <CategoriesTab />}
          {tab === "users" && <UsersTab />}
          {tab === "plans" && <PlansTab />}
          {tab === "payments" && <PaymentsTab />}
          {tab === "memberships" && <MembershipsTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

function FullPage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;
}

function ResourcesTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListResources);
  const save = useServerFn(adminSaveResource);
  const del = useServerFn(adminDeleteResource);
  const cats = useServerFn(listCategories);

  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const resources = useQuery({ queryKey: ["admin-resources"], queryFn: () => list() });
  const categories = useQuery({ queryKey: ["categories-admin"], queryFn: () => cats() });

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => save({ data: data as never }),
    onSuccess: () => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-resources"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-resources"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const blank = () => setEditing({
    slug: "", title: "", description: "", long_description: "", version: "1.0.0", mc_version: "1.20+",
    category_id: categories.data?.[0]?.id ?? null, author: "Cubyn Team", thumbnail_url: "", file_url: "",
    external_url: "", changelog: "", tags: [], featured: false, published: true,
    access_tier: "free", credit_cost: 0,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{resources.data?.length ?? 0} resources</p>
        <button onClick={blank} className="btn-glow hover:btn-glow-hover inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"><Plus size={14} /> New resource</button>
      </div>

      {editing && <ResourceEditor data={editing} setData={setEditing} categories={categories.data ?? []} onSave={(d) => saveMut.mutate(d)} onCancel={() => setEditing(null)} busy={saveMut.isPending} />}

      <div className="glass mt-6 overflow-hidden rounded-2xl">
        {(resources.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No resources yet. Create your first one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3 text-left">Title</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Ver</th><th className="px-4 py-3 text-left">DL</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {(resources.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium text-foreground">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(r as { categories?: { name?: string } }).categories?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.version}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.download_count}</td>
                  <td className="px-4 py-3">
                    {(() => { const t = (r as { access_tier?: string }).access_tier ?? "free"; const cc = (r as { credit_cost?: number }).credit_cost ?? 0;
                      const cls = t === "vip" ? "bg-amber-500/15 text-amber-400" : t === "credit" ? "bg-primary/15 text-primary" : "bg-emerald-500/15 text-emerald-400";
                      const label = t === "vip" ? "VIP" : t === "credit" ? `${cc} CR` : "FREE";
                      return <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
                    })()}
                    {r.featured && <span className="mr-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">FEATURED</span>}
                    {!r.published && <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">DRAFT</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(r as unknown as Record<string, unknown>)} className="mr-2 text-xs text-primary hover:underline">Edit</button>
                    <button onClick={() => { if (confirm(`Delete "${r.title}"?`)) delMut.mutate(r.id); }} className="text-xs text-destructive hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ResourceEditor({ data, setData, categories, onSave, onCancel, busy }: {
  data: Record<string, unknown>; setData: (d: Record<string, unknown>) => void;
  categories: Array<{ id: string; name: string }>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; busy: boolean;
}) {
  const uploadUrl = useServerFn(adminUploadUrl);
  const [uploading, setUploading] = useState<string | null>(null);

  const update = (k: string, v: unknown) => setData({ ...data, [k]: v });

  const uploadFile = async (file: File, field: "thumbnail_url" | "file_url") => {
    setUploading(field);
    try {
      const path = `${field}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { uploadUrl: url, token, publicUrl } = await uploadUrl({ data: { path } });
      const { error } = await supabase.storage.from("resources").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      update(field, publicUrl);
      toast.success(`${field === "thumbnail_url" ? "Thumbnail" : "File"} uploaded`);
      void url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(null); }
  };

  return (
    <div className="glass-strong mt-6 rounded-2xl p-6">
      <h3 className="font-display text-lg font-semibold">{data.id ? "Edit resource" : "New resource"}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Title"><input value={String(data.title ?? "")} onChange={(e) => update("title", e.target.value)} className={inp} /></Field>
        <Field label="Slug (url)"><input value={String(data.slug ?? "")} onChange={(e) => update("slug", e.target.value)} className={inp} placeholder="my-plugin" /></Field>
        <Field label="Short description" className="sm:col-span-2"><input value={String(data.description ?? "")} onChange={(e) => update("description", e.target.value)} className={inp} /></Field>
        <Field label="Long description" className="sm:col-span-2"><RichTextEditor value={String(data.long_description ?? "")} onChange={(v) => update("long_description", v)} rows={6} placeholder="Describe the resource. Select text and click Bold." /></Field>
        <Field label="Author"><input value={String(data.author ?? "")} onChange={(e) => update("author", e.target.value)} className={inp} /></Field>
        <Field label="Category">
          <select value={String(data.category_id ?? "")} onChange={(e) => update("category_id", e.target.value || null)} className={inp}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Version"><input value={String(data.version ?? "")} onChange={(e) => update("version", e.target.value)} className={inp} /></Field>
        <Field label="MC Version"><input value={String(data.mc_version ?? "")} onChange={(e) => update("mc_version", e.target.value)} className={inp} /></Field>
        <Field label="Thumbnail" className="sm:col-span-2">
          <div className="flex gap-2">
            <input value={String(data.thumbnail_url ?? "")} onChange={(e) => update("thumbnail_url", e.target.value)} placeholder="https://… or upload" className={inp} />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-secondary">
              <Upload size={12} /> {uploading === "thumbnail_url" ? "…" : "Upload"}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "thumbnail_url")} />
            </label>
          </div>
        </Field>
        <Field label="Download file" className="sm:col-span-2">
          <div className="flex gap-2">
            <input value={String(data.file_url ?? "")} onChange={(e) => update("file_url", e.target.value)} placeholder="https://… or upload" className={inp} />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-secondary">
              <Upload size={12} /> {uploading === "file_url" ? "…" : "Upload"}
              <input type="file" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "file_url")} />
            </label>
          </div>
        </Field>
        <Field label="External URL (optional)" className="sm:col-span-2"><input value={String(data.external_url ?? "")} onChange={(e) => update("external_url", e.target.value)} className={inp} /></Field>
        <Field label="Tags (comma separated)" className="sm:col-span-2">
          <input value={Array.isArray(data.tags) ? (data.tags as string[]).join(", ") : ""}
            onChange={(e) => update("tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className={inp} />
        </Field>
        <Field label="Changelog" className="sm:col-span-2"><RichTextEditor value={String(data.changelog ?? "")} onChange={(v) => update("changelog", v)} rows={4} placeholder="What changed in this version?" /></Field>
        <Field label="Access tier">
          <select value={String(data.access_tier ?? "free")} onChange={(e) => update("access_tier", e.target.value)} className={inp}>
            <option value="free">Free — anyone signed in</option>
            <option value="credit">Paid (Credits)</option>
            <option value="vip">VIP only</option>
          </select>
        </Field>
        <Field label="Credit cost (only for Paid tier)">
          <input type="number" min={0} disabled={data.access_tier !== "credit"} value={Number(data.credit_cost ?? 0)}
            onChange={(e) => update("credit_cost", Number(e.target.value))} className={`${inp} disabled:opacity-50`} />
        </Field>
        <div className="flex items-center gap-6 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!data.featured} onChange={(e) => update("featured", e.target.checked)} /> Featured</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!data.published} onChange={(e) => update("published", e.target.checked)} /> Published</label>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <button onClick={() => onSave(data)} disabled={busy} className="btn-glow hover:btn-glow-hover inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm disabled:opacity-60"><Save size={14} /> {busy ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg bg-input/60 px-3 py-2 text-sm text-foreground outline-none ring-1 ring-border/60 focus:ring-primary";
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span><div className="mt-1.5">{children}</div></label>;
}

function CategoriesTab() {
  const qc = useQueryClient();
  const list = useServerFn(listCategories);
  const save = useServerFn(adminSaveCategory);
  const del = useServerFn(adminDeleteCategory);
  const cats = useQuery({ queryKey: ["categories-admin"], queryFn: () => list() });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const saveMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => save({ data: d as never }),
    onSuccess: () => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["categories-admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["categories-admin"] }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cats.data?.length ?? 0} categories</p>
        <button onClick={() => setEditing({ slug: "", name: "", icon: "Package", description: "", sort_order: 99 })}
          className="btn-glow hover:btn-glow-hover inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"><Plus size={14} /> New category</button>
      </div>

      {editing && (
        <div className="glass-strong mt-6 rounded-2xl p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input value={String(editing.name ?? "")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} /></Field>
            <Field label="Slug"><input value={String(editing.slug ?? "")} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className={inp} /></Field>
            <Field label="Icon name"><input value={String(editing.icon ?? "")} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className={inp} /></Field>
            <Field label="Sort order"><input type="number" value={Number(editing.sort_order ?? 0)} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={inp} /></Field>
            <Field label="Description" className="sm:col-span-2"><input value={String(editing.description ?? "")} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inp} /></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => saveMut.mutate(editing)} className="btn-glow hover:btn-glow-hover inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"><Save size={14} /> Save</button>
            <button onClick={() => setEditing(null)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="glass mt-6 divide-y divide-border/40 rounded-2xl">
        {(cats.data ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-foreground">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.slug} · {c.description}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(c as unknown as Record<string, unknown>)} className="text-xs text-primary hover:underline">Edit</button>
              <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) delMut.mutate(c.id); }} className="text-xs text-destructive hover:underline"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const save = useServerFn(adminSaveSettings);
  const settings = useQuery({ queryKey: ["settings-admin"], queryFn: () => fetchSettings() });
  const [local, setLocal] = useState<Record<string, unknown> | null>(null);

  const data = local ?? (settings.data as Record<string, unknown> | undefined) ?? {};
  const hero = (data.hero as Record<string, string> | undefined) ?? {};
  const about = (data.about as Record<string, string> | undefined) ?? {};
  const contact = (data.contact as Record<string, string> | undefined) ?? {};
  const footer = (data.footer as Record<string, string> | undefined) ?? {};
  const payment = (data.payment as Record<string, string | number> | undefined) ?? {};
  const limits = (data.limits as Record<string, number | null> | undefined) ?? {};
  const credits = (data.credits as Record<string, number> | undefined) ?? {};

  const set = (section: string, field: string, value: string | number | null) => {
    const next = { ...data, [section]: { ...((data[section] as Record<string, unknown>) ?? {}), [field]: value } };
    setLocal(next);
  };


  const saveMut = useMutation({
    mutationFn: () => save({ data: { data: data as Record<string, unknown> } }),
    onSuccess: () => { toast.success("Settings saved"); setLocal(null); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (settings.isLoading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <Section title="Hero">
        <Field label="Title"><input value={hero.title ?? ""} onChange={(e) => set("hero", "title", e.target.value)} className={inp} /></Field>
        <Field label="Subtitle"><input value={hero.subtitle ?? ""} onChange={(e) => set("hero", "subtitle", e.target.value)} className={inp} /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea value={hero.description ?? ""} onChange={(e) => set("hero", "description", e.target.value)} rows={3} className={inp} /></Field>
        <Field label="Primary CTA"><input value={hero.primaryCta ?? ""} onChange={(e) => set("hero", "primaryCta", e.target.value)} className={inp} /></Field>
        <Field label="Secondary CTA"><input value={hero.secondaryCta ?? ""} onChange={(e) => set("hero", "secondaryCta", e.target.value)} className={inp} /></Field>
      </Section>

      <Section title="About">
        <Field label="Title" className="sm:col-span-2"><input value={about.title ?? ""} onChange={(e) => set("about", "title", e.target.value)} className={inp} /></Field>
        <Field label="Body" className="sm:col-span-2"><textarea value={about.body ?? ""} onChange={(e) => set("about", "body", e.target.value)} rows={6} className={inp} /></Field>
      </Section>

      <Section title="Contact">
        <Field label="Email"><input value={contact.email ?? ""} onChange={(e) => set("contact", "email", e.target.value)} className={inp} /></Field>
        <Field label="Discord URL"><input value={contact.discord ?? ""} onChange={(e) => set("contact", "discord", e.target.value)} className={inp} /></Field>
        <Field label="Twitter URL"><input value={contact.twitter ?? ""} onChange={(e) => set("contact", "twitter", e.target.value)} className={inp} /></Field>
        <Field label="GitHub URL"><input value={contact.github ?? ""} onChange={(e) => set("contact", "github", e.target.value)} className={inp} /></Field>
      </Section>

      <Section title="Footer">
        <Field label="Tagline" className="sm:col-span-2"><input value={footer.tagline ?? ""} onChange={(e) => set("footer", "tagline", e.target.value)} className={inp} /></Field>
      </Section>

      <Section title="Payments (GCash / Maya)">
        <Field label="GCash number"><input value={String(payment.gcash_number ?? "")} onChange={(e) => set("payment", "gcash_number", e.target.value)} className={inp} placeholder="09xx-xxx-xxxx" /></Field>
        <Field label="GCash account name"><input value={String(payment.gcash_name ?? "")} onChange={(e) => set("payment", "gcash_name", e.target.value)} className={inp} /></Field>
        <Field label="Maya number"><input value={String(payment.maya_number ?? "")} onChange={(e) => set("payment", "maya_number", e.target.value)} className={inp} placeholder="09xx-xxx-xxxx" /></Field>
        <Field label="Maya account name"><input value={String(payment.maya_name ?? "")} onChange={(e) => set("payment", "maya_name", e.target.value)} className={inp} /></Field>
        <Field label="Auto-approve OCR threshold (0–1)"><input type="number" step="0.05" min="0" max="1" value={Number(payment.ocr_confidence_threshold ?? 0.8)} onChange={(e) => set("payment", "ocr_confidence_threshold", Number(e.target.value))} className={inp} /></Field>
        <Field label="Instructions to buyer" className="sm:col-span-2"><textarea rows={3} value={String(payment.instructions ?? "")} onChange={(e) => set("payment", "instructions", e.target.value)} className={inp} placeholder="e.g. Include your username in the message…" /></Field>
      </Section>

      <Section title="Download limits & Credits">
        <Field label="Member daily downloads"><input type="number" min="0" value={Number(limits.member_daily ?? 10)} onChange={(e) => set("limits", "member_daily", Number(e.target.value))} className={inp} /></Field>
        <Field label="VIP daily downloads (blank = unlimited)"><input type="number" min="0" value={limits.vip_daily ?? ""} onChange={(e) => set("limits", "vip_daily", e.target.value === "" ? null : Number(e.target.value))} className={inp} /></Field>
        <Field label="Signup bonus credits"><input type="number" min="0" value={Number(credits.signup_bonus ?? 20)} onChange={(e) => set("credits", "signup_bonus", Number(e.target.value))} className={inp} /></Field>
        <Field label="Daily login credits"><input type="number" min="0" value={Number(credits.daily_login ?? 5)} onChange={(e) => set("credits", "daily_login", Number(e.target.value))} className={inp} /></Field>
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <button onClick={() => saveMut.mutate()} disabled={!local || saveMut.isPending}
          className="btn-glow hover:btn-glow-hover inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm disabled:opacity-50">
          <Save size={14} /> {saveMut.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// =============================================================
// Users tab
// =============================================================
function UsersTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListUsers);
  const grant = useServerFn(adminGrantRole);
  const adj = useServerFn(adminAdjustCredits);
  const [q, setQ] = useState("");
  const users = useQuery({ queryKey: ["admin-users", q], queryFn: () => list({ data: { q } }) });

  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "vip" | "member"; grant: boolean }) => grant({ data: v }),
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const adjMut = useMutation({
    mutationFn: (v: { user_id: string; delta: number; reason: string }) => adj({ data: v }),
    onSuccess: () => { toast.success("Credits adjusted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name…"
        className="w-full max-w-sm rounded-lg bg-input/60 px-3 py-2 text-sm outline-none ring-1 ring-border/60 focus:ring-primary" />
      <div className="glass mt-4 overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-left">User</th><th className="px-4 py-3 text-left">Roles</th><th className="px-4 py-3 text-left">Credits</th><th className="px-4 py-3 text-left">VIP exp</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{u.display_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {(["admin","vip","member"] as const).map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <button key={r} onClick={() => grantMut.mutate({ user_id: u.id, role: r, grant: !has })}
                        className={`mr-1 rounded px-1.5 py-0.5 ${has ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                        {r}
                      </button>
                    );
                  })}
                </td>
                <td className="px-4 py-3 text-foreground">{u.credits}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{u.vip_expires_at ? new Date(u.vip_expires_at).toLocaleDateString() : (u.roles.includes("vip") ? "—" : "")}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => {
                    const v = prompt(`Adjust credits for ${u.email} (+/- amount):`, "10");
                    if (!v) return;
                    const delta = Number(v); if (!Number.isFinite(delta)) return toast.error("Invalid number");
                    const reason = prompt("Reason:", "admin_adjust") ?? "admin_adjust";
                    adjMut.mutate({ user_id: u.id, delta, reason });
                  }} className="text-xs text-primary hover:underline">Adjust credits</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================
// Plans tab
// =============================================================
function PlansTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListPlans);
  const save = useServerFn(adminSavePlan);
  const del = useServerFn(adminDeletePlan);
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => list() });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const saveMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => save({ data: d as never }),
    onSuccess: () => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-plans"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-plans"] }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{plans.data?.length ?? 0} plans</p>
        <button onClick={() => setEditing({ name: "", description: "", price_php: 99, duration_days: 30, sort_order: 0, active: true })}
          className="btn-glow hover:btn-glow-hover inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"><Plus size={14} /> New plan</button>
      </div>

      {editing && (
        <div className="glass-strong mt-6 rounded-2xl p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input value={String(editing.name ?? "")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} /></Field>
            <Field label="Price (PHP)"><input type="number" min="0" value={Number(editing.price_php ?? 0)} onChange={(e) => setEditing({ ...editing, price_php: Number(e.target.value) })} className={inp} /></Field>
            <Field label="Duration days (blank = lifetime)">
              <input type="number" min="1" value={editing.duration_days == null ? "" : Number(editing.duration_days)}
                onChange={(e) => setEditing({ ...editing, duration_days: e.target.value === "" ? null : Number(e.target.value) })} className={inp} />
            </Field>
            <Field label="Sort order"><input type="number" value={Number(editing.sort_order ?? 0)} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={inp} /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea rows={2} value={String(editing.description ?? "")} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inp} /></Field>
            <label className="inline-flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => saveMut.mutate(editing)} disabled={saveMut.isPending} className="btn-glow hover:btn-glow-hover inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"><Save size={14} /> Save</button>
            <button onClick={() => setEditing(null)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="glass mt-6 divide-y divide-border/40 rounded-2xl">
        {(plans.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-foreground">{p.name} <span className="ml-2 text-xs text-muted-foreground">₱{p.price_php} · {p.duration_days ?? "lifetime"}{p.duration_days ? " days" : ""}{!p.active ? " · inactive" : ""}</span></div>
              <div className="text-xs text-muted-foreground">{p.description}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(p as unknown as Record<string, unknown>)} className="text-xs text-primary hover:underline">Edit</button>
              <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) delMut.mutate(p.id); }} className="text-xs text-destructive hover:underline"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================
// Payments / Receipts review tab
// =============================================================
function PaymentsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListReceipts);
  const approve = useServerFn(adminApproveReceipt);
  const reject = useServerFn(adminRejectReceipt);
  const [status, setStatus] = useState("");
  const rec = useQuery({ queryKey: ["admin-receipts", status], queryFn: () => list({ data: { status: status || undefined } }) });

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: () => { toast.success("Approved · VIP granted"); qc.invalidateQueries({ queryKey: ["admin-receipts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rejectMut = useMutation({
    mutationFn: (v: { id: string; note: string }) => reject({ data: v }),
    onSuccess: () => { toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["admin-receipts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {["", "flagged", "auto_approved", "approved", "rejected"].map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs ${status === s ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(rec.data ?? []).map((r) => {
          const plan = (r as { membership_plans?: { name?: string; price_php?: number } }).membership_plans;
          return (
            <div key={r.id} className="glass-strong overflow-hidden rounded-2xl">
              {r.image_url && <a href={r.image_url} target="_blank" rel="noreferrer"><img src={r.image_url} alt="receipt" className="max-h-64 w-full object-cover" /></a>}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{plan?.name ?? "Plan"} · ₱{plan?.price_php ?? "—"}</span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase">{r.status}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <div>Method: {r.method.toUpperCase()} · OCR ₱{r.ocr_amount_php ?? "—"} · Conf {((r.ocr_confidence ?? 0) * 100).toFixed(0)}%</div>
                  <div>Ref: {r.ocr_reference ?? "—"}</div>
                  {r.flags && r.flags.length > 0 && <div className="mt-1 text-yellow-400">Flags: {r.flags.join(", ")}</div>}
                  {r.admin_notes && <div className="mt-1">Note: {r.admin_notes}</div>}
                  <div className="mt-1">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                {(r.status === "flagged" || r.status === "pending") && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => approveMut.mutate(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs text-primary hover:bg-primary/30">
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button onClick={() => {
                      const note = prompt("Rejection note (sent to user):", "Could not verify payment");
                      if (note) rejectMut.mutate({ id: r.id, note });
                    }} className="inline-flex items-center gap-1 rounded-lg bg-destructive/20 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/30">
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {(rec.data?.length ?? 0) === 0 && <p className="col-span-full text-center text-muted-foreground">No receipts.</p>}
      </div>
    </div>
  );
}

// =============================================================
// Memberships tab
// =============================================================
function MembershipsTab() {
  const list = useServerFn(adminListMemberships);
  const q = useQuery({ queryKey: ["admin-memberships"], queryFn: () => list() });
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
          <tr><th className="px-4 py-3 text-left">User</th><th className="px-4 py-3 text-left">Plan</th><th className="px-4 py-3 text-left">Starts</th><th className="px-4 py-3 text-left">Expires</th><th className="px-4 py-3 text-left">Source</th></tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((m) => {
            const plan = (m as { membership_plans?: { name?: string } }).membership_plans;
            const expired = m.expires_at && new Date(m.expires_at).getTime() < Date.now();
            return (
              <tr key={m.id} className="border-t border-border/40">
                <td className="px-4 py-3 text-xs text-muted-foreground">{m.user_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-foreground">{plan?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(m.starts_at).toLocaleDateString()}</td>
                <td className={`px-4 py-3 text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}>{m.expires_at ? new Date(m.expires_at).toLocaleDateString() : "Lifetime"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{m.source}</td>
              </tr>
            );
          })}
          {(q.data?.length ?? 0) === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No memberships yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
