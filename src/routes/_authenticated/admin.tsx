import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Save, Upload, Settings as Cog, FolderTree, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { RichTextEditor } from "@/components/RichTextEditor";
import { listCategories } from "@/lib/resources.functions";
import {
  adminCheck, adminListResources, adminSaveResource, adminDeleteResource,
  adminSaveCategory, adminDeleteCategory, adminSaveSettings, adminUploadUrl, adminPromoteSelf,
} from "@/lib/admin.functions";
import { getSettings } from "@/lib/resources.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Cubyn Spigot" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Tab = "resources" | "categories" | "settings";

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
    navigate({ to: "/auth", replace: true });
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

        <div className="glass mt-6 inline-flex gap-1 rounded-xl p-1">
          {[
            { id: "resources" as const, icon: Package, label: "Resources" },
            { id: "categories" as const, icon: FolderTree, label: "Categories" },
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
                  <td className="px-4 py-3">{r.featured && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">FEATURED</span>} {!r.published && <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">DRAFT</span>}</td>
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
        <Field label="Changelog" className="sm:col-span-2"><textarea value={String(data.changelog ?? "")} onChange={(e) => update("changelog", e.target.value)} rows={4} className={inp} /></Field>
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

  const set = (section: string, field: string, value: string) => {
    const next = { ...data, [section]: { ...((data[section] as Record<string, string>) ?? {}), [field]: value } };
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
