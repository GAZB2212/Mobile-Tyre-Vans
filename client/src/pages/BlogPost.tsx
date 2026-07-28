import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { CalendarDays, Tag, ArrowLeft, User, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO, { createBreadcrumbStructuredData, createArticleStructuredData } from "@/components/SEO";
import type { BlogPost } from "@shared/schema";

function formatContent(raw: string): string {
  const trimmed = raw.trim();
  const hasHtml = /<([a-z][a-z0-9]*)\b[^>]*>/i.test(trimmed);
  if (hasHtml) return trimmed;

  return trimmed
    .split(/\n{2,}/)
    .map(para => {
      const lines = para.trim().replace(/\n/g, "<br />");
      return `<p>${lines}</p>`;
    })
    .join("\n");
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: ["/api/blog-posts", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog-posts/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const date = post?.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const updatedDate = (() => {
    if (!post?.updatedAt || !post?.publishedAt) return null;
    const updated = new Date(post.updatedAt).getTime();
    const published = new Date(post.publishedAt).getTime();
    if (updated - published < 24 * 60 * 60 * 1000) return null;
    return new Date(post.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  })();

  const breadcrumb = post
    ? createBreadcrumbStructuredData([
        { name: "Home", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: post.title, url: `/blog/${post.slug}` },
      ])
    : null;

  const articleData = post
    ? createArticleStructuredData({
        title: post.seoTitle || post.title,
        description: post.seoDescription || post.summary,
        slug: post.slug,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        authorName: post.authorName,
        featuredImage: post.featuredImage,
      })
    : null;

  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <p className="text-muted-foreground mb-6">This article doesn't exist or has been removed.</p>
          <Button asChild>
            <Link href="/blog">Back to Blog</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {post && (
        <SEO
          title={post.seoTitle || post.title}
          description={post.seoDescription || post.summary}
          canonical={`/blog/${post.slug}`}
          ogType="article"
          structuredData={[...(breadcrumb ? [breadcrumb] : []), ...(articleData ? [articleData] : [])]}
        />
      )}
      <Header />
      <div>
        <article className="container mx-auto max-w-3xl px-4 py-10">
          <Button variant="ghost" asChild className="mb-6 -ml-2 text-muted-foreground" data-testid="button-back-blog">
            <Link href="/blog">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Blog
            </Link>
          </Button>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="aspect-video w-full mt-4" />
              <div className="space-y-2 mt-6">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            </div>
          ) : post ? (
            <>
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {post.category && (
                  <Badge variant="secondary" data-testid="badge-post-category">{post.category}</Badge>
                )}
                {date && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="text-post-date">
                    <CalendarDays className="w-3.5 h-3.5" /> {date}
                  </span>
                )}
                {updatedDate && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="text-post-updated">
                    <RefreshCw className="w-3.5 h-3.5" /> Updated {updatedDate}
                  </span>
                )}
                {post.authorName && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground" data-testid="text-post-author">
                    <User className="w-3.5 h-3.5" /> {post.authorName}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight mb-4" data-testid="heading-post-title">
                {post.title}
              </h1>

              {/* Summary */}
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed" data-testid="text-post-summary">
                {post.summary}
              </p>

              {/* Featured image */}
              {post.featuredImage && (
                <div className="rounded-md overflow-hidden mb-8">
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    className="w-full object-cover max-h-[480px]"
                    data-testid="img-post-featured"
                  />
                </div>
              )}

              {/* Content */}
              <div
                className="prose prose-invert max-w-none text-foreground
                  prose-headings:font-semibold prose-headings:text-foreground
                  prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-foreground prose-li:text-muted-foreground
                  prose-h2:text-xl prose-h3:text-lg"
                dangerouslySetInnerHTML={{ __html: formatContent(post.content) }}
                data-testid="div-post-content"
              />

              {/* Author card */}
              <div className="mt-10 pt-6 border-t border-border" data-testid="div-author-card">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-muted flex items-center justify-center" aria-hidden="true">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Written by</p>
                    <p className="font-semibold text-foreground" data-testid="text-author-name">
                      {post.authorName || "MTV Team"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed" data-testid="text-author-bio">
                      {post.authorBio || "The Mobile Tyre Vans team are specialists in mobile tyre van conversions, helping businesses across the UK build profitable, road-ready operations."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-border" data-testid="div-post-tags">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {post.tags.map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}

              {/* Back link */}
              <div className="mt-10 pt-6 border-t border-border">
                <Button asChild variant="outline" data-testid="button-back-bottom">
                  <Link href="/blog"><ArrowLeft className="w-4 h-4 mr-1" />All Articles</Link>
                </Button>
              </div>
            </>
          ) : null}
        </article>
      </div>
      <Footer />
    </div>
  );
}
