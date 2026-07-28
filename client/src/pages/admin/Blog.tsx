import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminBackButton } from "@/components/AdminBackButton";
import { Plus, Pencil, Trash2, Eye, EyeOff, Upload, CheckCircle2, Loader2, Globe, FileText, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFileUpload, uploadToObjectStorage } from "@/hooks/use-file-upload";
import type { BlogPost } from "@shared/schema";

const CATEGORIES = [
  "Industry News",
  "Business Tips",
  "Technical Guides",
  "Customer Stories",
  "Product Updates",
  "Company News",
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ImageUpload({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const { uploading, inputRef, handleChange } = useFileUpload({
    uploadFn: (file) => uploadToObjectStorage(file, file.type || "image/jpeg"),
    onSuccess: onUploaded,
    successToast: { title: "Image uploaded" },
    errorToast: { title: "Upload failed" },
  });

  return (
    <div className="space-y-2">
      <Label>Featured Image</Label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} data-testid="input-featured-image" />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()} data-testid="button-upload-image">
          {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Choose Image</>}
        </Button>
        {currentUrl && (
          <span className="flex items-center gap-1 text-sm text-accent">
            <CheckCircle2 className="w-4 h-4" />{currentUrl.split("/").pop()}
          </span>
        )}
      </div>
      {currentUrl && (
        <div className="mt-2 rounded-md overflow-hidden w-40 h-24 bg-muted">
          <img src={currentUrl} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

const emptyForm = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  featuredImage: "",
  category: "",
  tags: "",
  published: false,
  seoTitle: "",
  seoDescription: "",
  authorName: "",
  authorBio: "",
};

type FormState = typeof emptyForm;

function PostForm({
  initial,
  onSubmit,
  isSubmitting,
  onClose,
}: {
  initial: FormState;
  onSubmit: (data: FormState) => void;
  isSubmitting: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [autoSlug, setAutoSlug] = useState(!initial.slug);
  const [showSeo, setShowSeo] = useState(false);

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleTitleChange = (v: string) => {
    set("title", v);
    if (autoSlug) set("slug", slugify(v));
  };

  const handleSlugChange = (v: string) => {
    setAutoSlug(false);
    set("slug", slugify(v));
  };

  return (
    <div className="space-y-5 py-1">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Your blog post title" data-testid="input-title" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="slug">URL Slug *</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">/blog/</span>
            <Input id="slug" value={form.slug} onChange={e => handleSlugChange(e.target.value)} placeholder="my-post-slug" data-testid="input-slug" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={form.category}
            onChange={e => set("category", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="select-category"
          >
            <option value="">No category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="authorName">Author</Label>
          <Input id="authorName" value={form.authorName} onChange={e => set("authorName", e.target.value)} placeholder="e.g. MTV Team" data-testid="input-author" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="authorBio">Author Bio <span className="text-muted-foreground font-normal">(shown at the bottom of the post)</span></Label>
          <Textarea id="authorBio" value={form.authorBio} onChange={e => set("authorBio", e.target.value)} rows={2} placeholder="A short 1–2 sentence bio about the author. Leave blank to show a default MTV Team blurb." data-testid="input-author-bio" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="summary">Summary * <span className="text-muted-foreground font-normal">(shown on listing cards)</span></Label>
          <Textarea id="summary" value={form.summary} onChange={e => set("summary", e.target.value)} rows={2} placeholder="A short teaser for the post..." data-testid="input-summary" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="content">Content * <span className="text-muted-foreground font-normal">(HTML supported)</span></Label>
          <Textarea id="content" value={form.content} onChange={e => set("content", e.target.value)} rows={12} placeholder="Write your post here. You can use HTML tags like <h2>, <p>, <strong>, <ul>, <li>, <a href='...'>, etc." className="font-mono text-sm" data-testid="input-content" />
        </div>
        <div className="sm:col-span-2">
          <ImageUpload currentUrl={form.featuredImage} onUploaded={url => set("featuredImage", url)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tags">Tags <span className="text-muted-foreground font-normal">(comma separated)</span></Label>
          <Input id="tags" value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="mobile tyres, van conversion, business tips" data-testid="input-tags" />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3 pt-1">
          <Switch id="published" checked={form.published} onCheckedChange={v => set("published", v)} data-testid="switch-published" />
          <Label htmlFor="published" className="cursor-pointer">
            {form.published ? <span className="flex items-center gap-1 text-accent"><Globe className="w-3.5 h-3.5" />Published (live on site)</span> : <span className="text-muted-foreground">Draft (not visible to public)</span>}
          </Label>
        </div>
      </div>

      {/* SEO accordion */}
      <div className="border border-border rounded-md">
        <button
          type="button"
          onClick={() => setShowSeo(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left"
          data-testid="button-toggle-seo"
        >
          <span className="flex items-center gap-2"><FileText className="w-4 h-4" />SEO Settings (optional)</span>
          <span className="text-muted-foreground text-xs">{showSeo ? "Hide" : "Show"}</span>
        </button>
        {showSeo && (
          <div className="px-4 pb-4 space-y-3 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="seoTitle">SEO Title</Label>
              <Input id="seoTitle" value={form.seoTitle} onChange={e => set("seoTitle", e.target.value)} placeholder={form.title || "Custom page title for search engines"} data-testid="input-seo-title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seoDescription">SEO Description</Label>
              <Textarea id="seoDescription" value={form.seoDescription} onChange={e => set("seoDescription", e.target.value)} rows={2} placeholder={form.summary || "Custom meta description for search engines"} data-testid="input-seo-description" />
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">Cancel</Button>
        <Button type="button" disabled={isSubmitting || !form.title || !form.slug || !form.summary || !form.content} onClick={() => onSubmit(form)} data-testid="button-save">
          {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Post"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function formToPayload(form: FormState) {
  return {
    title: form.title,
    slug: form.slug,
    summary: form.summary,
    content: form.content,
    featuredImage: form.featuredImage || null,
    category: form.category || null,
    tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    published: form.published,
    seoTitle: form.seoTitle || null,
    seoDescription: form.seoDescription || null,
    authorName: form.authorName || null,
    authorBio: form.authorBio || null,
  };
}

function postToForm(post: BlogPost): FormState {
  return {
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    content: post.content,
    featuredImage: post.featuredImage || "",
    category: post.category || "",
    tags: (post.tags || []).join(", "),
    published: post.published,
    seoTitle: post.seoTitle || "",
    seoDescription: post.seoDescription || "",
    authorName: post.authorName || "",
    authorBio: post.authorBio || "",
  };
}

export default function AdminBlog() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateKeyword, setGenerateKeyword] = useState("");

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/admin/blog-posts"],
  });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formToPayload>) =>
      apiRequest("POST", "/api/admin/blog-posts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      setIsCreateOpen(false);
      toast({ title: "Post created" });
    },
    onError: (err: any) => toast({ title: "Error", description: String(err.message), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReturnType<typeof formToPayload> }) =>
      apiRequest("PUT", `/api/admin/blog-posts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      setEditPost(null);
      toast({ title: "Post updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: String(err.message), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/blog-posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      setDeleteId(null);
      toast({ title: "Post deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: (keyword: string) =>
      apiRequest("POST", "/api/admin/blog-posts/generate", keyword ? { keyword } : {}),
    onSuccess: (post: BlogPost) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      setIsGenerateOpen(false);
      setGenerateKeyword("");
      setEditPost(post);
      toast({ title: "Post generated", description: "Saved as draft — review and publish when ready." });
    },
    onError: (err: any) => toast({ title: "Generation failed", description: String(err.message), variant: "destructive" }),
  });

  const togglePublish = (post: BlogPost) => {
    updateMutation.mutate({ id: post.id, data: formToPayload({ ...postToForm(post), published: !post.published }) });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <AdminBackButton />

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">Blog Posts</CardTitle>
              <CardDescription>Create and manage articles for the public blog</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setIsGenerateOpen(true)} data-testid="button-generate-post">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate with AI
              </Button>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} data-testid="button-new-post">
                <Plus className="w-3.5 h-3.5 mr-1.5" />New Post
              </Button>
            </div>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-md" data-testid="text-no-posts">
            No posts yet. Click "New Post" to get started.
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map(post => {
                  const dateStr = post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : new Date(post.createdAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <TableRow key={post.id} data-testid={`row-post-${post.id}`}>
                      <TableCell className="font-medium max-w-xs">
                        <div className="truncate">{post.title}</div>
                        <div className="text-xs text-muted-foreground">/blog/{post.slug}</div>
                      </TableCell>
                      <TableCell>
                        {post.category ? <Badge variant="secondary">{post.category}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={post.published ? "default" : "outline"} className={post.published ? "bg-accent/20 text-accent border-accent/30" : ""}>
                          {post.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dateStr}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={post.published ? "Unpublish post" : "Publish post"}
                                onClick={() => togglePublish(post)}
                                data-testid={`button-toggle-${post.id}`}
                              >
                                {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{post.published ? "Unpublish post" : "Publish post"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Edit post"
                                onClick={() => setEditPost(post)}
                                data-testid={`button-edit-${post.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit post</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Delete post"
                                onClick={() => setDeleteId(post.id)}
                                data-testid={`button-delete-${post.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete post</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Blog Post</DialogTitle>
            </DialogHeader>
            <PostForm
              initial={emptyForm}
              onSubmit={form => createMutation.mutate(formToPayload(form))}
              isSubmitting={createMutation.isPending}
              onClose={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Edit dialog */}
        <Dialog open={!!editPost} onOpenChange={open => !open && setEditPost(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Blog Post</DialogTitle>
            </DialogHeader>
            {editPost && (
              <PostForm
                initial={postToForm(editPost)}
                onSubmit={form => updateMutation.mutate({ id: editPost.id, data: formToPayload(form) })}
                isSubmitting={updateMutation.isPending}
                onClose={() => setEditPost(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* AI Generate dialog */}
        <Dialog open={isGenerateOpen} onOpenChange={open => { setIsGenerateOpen(open); if (!open) setGenerateKeyword(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#8bc440]" />Generate Blog Post with AI
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                AI will write a complete SEO blog post targeting the keyword below. It will be saved as a <strong>draft</strong> so you can review and edit before publishing. Takes around 15–30 seconds.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="gen-keyword">Target Keyword <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="gen-keyword"
                  value={generateKeyword}
                  onChange={e => setGenerateKeyword(e.target.value)}
                  placeholder="e.g. how to start a mobile tyre business UK"
                  data-testid="input-generate-keyword"
                />
                <p className="text-xs text-muted-foreground">Leave blank to auto-select the next keyword from the rotation list.</p>
              </div>
              {generateMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating your post — this usually takes 15–30 seconds...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGenerateOpen(false)} disabled={generateMutation.isPending} data-testid="button-cancel-generate">Cancel</Button>
              <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate(generateKeyword)} data-testid="button-confirm-generate">
                {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Post</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Post</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">Are you sure you want to permanently delete this post? This cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)} data-testid="button-cancel-delete">Cancel</Button>
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)} data-testid="button-confirm-delete">
                {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
