import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarDays, Tag, ArrowRight, Rss, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import type { BlogPost } from "@shared/schema";

function PostCard({ post }: { post: BlogPost }) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const updatedDate = (() => {
    if (!post.updatedAt || !post.publishedAt) return null;
    const updated = new Date(post.updatedAt).getTime();
    const published = new Date(post.publishedAt).getTime();
    if (updated - published < 24 * 60 * 60 * 1000) return null;
    return new Date(post.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  })();

  return (
    <Card className="flex flex-col overflow-hidden hover-elevate" data-testid={`card-blog-${post.id}`}>
      {post.featuredImage && (
        <div className="aspect-video overflow-hidden bg-muted">
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-full object-cover"
            data-testid={`img-blog-${post.id}`}
          />
        </div>
      )}
      <CardHeader className="pb-2 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {post.category && (
            <Badge variant="secondary" data-testid={`badge-category-${post.id}`}>{post.category}</Badge>
          )}
          {date && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-date-${post.id}`}>
              <CalendarDays className="w-3 h-3" />
              {date}
            </span>
          )}
          {updatedDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-updated-${post.id}`}>
              <RefreshCw className="w-3 h-3" />
              Updated {updatedDate}
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-snug line-clamp-2" data-testid={`text-title-${post.id}`}>
          {post.title}
        </h2>
      </CardHeader>
      <CardContent className="pb-2 flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-summary-${post.id}`}>
          {post.summary}
        </p>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="w-3 h-3" />{tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="ghost" asChild className="p-0 h-auto text-accent hover:bg-transparent" data-testid={`link-read-more-${post.id}`}>
          <Link href={`/blog/${post.slug}`}>
            Read more <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function BlogSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <Card key={i} className="flex flex-col">
          <Skeleton className="aspect-video" />
          <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog-posts"],
  });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Blog | Mobile Tyre Van Insights & Industry News"
        description="Expert advice, industry news, and practical guides for mobile tyre van operators. Tips on growing your mobile tyre business from the team at Mobile Tyre Vans."
        canonical="/blog"
        keywords="mobile tyre van blog, mobile tyre business tips, tyre van advice, tyre fitting industry news"
      />
      <Header />
      <div>
        <section className="py-12 px-4 border-b border-border">
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center gap-3 mb-2">
              <Rss className="w-6 h-6 text-accent" />
              <h1 className="text-3xl md:text-4xl font-bold" data-testid="heading-blog">The MTV Blog</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl" data-testid="text-blog-subtitle">
              Industry insights, expert guides, and the latest news from the UK's leading mobile tyre van conversion specialists.
            </p>
          </div>
        </section>

        <section className="py-10 px-4">
          <div className="container mx-auto max-w-6xl">
            {isLoading ? (
              <BlogSkeleton />
            ) : posts.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground" data-testid="text-no-posts">
                <Rss className="w-10 h-10 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No posts yet — check back soon.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-blog-posts">
                {posts.map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
