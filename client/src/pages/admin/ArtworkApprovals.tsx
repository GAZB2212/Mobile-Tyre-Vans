import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Clock, ExternalLink, Palette } from "lucide-react";

interface ArtworkApprovalRow {
  id: string;
  user_name: string;
  email: string;
  wrapgen_preview_id: string;
  wrapgen_preview_url: string;
  artwork_approved_at: string | null;
  artwork_approved_by: string | null;
  wrapgen_proof_sent_at: string | null;
  created_at: string;
  status: string;
  selected_upgrade_ids: string[];
  make: string | null;
  model: string | null;
  year: number | null;
  custom_van_description: string | null;
  wrap_type_name: string | null;
}

function vanLabel(row: ArtworkApprovalRow) {
  if (row.make && row.model) return `${row.year ?? ""} ${row.make} ${row.model}`.trim();
  if (row.custom_van_description) return row.custom_van_description;
  return "Van not specified";
}

export default function ArtworkApprovals() {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery<ArtworkApprovalRow[]>({
    queryKey: ["/api/admin/artwork-approvals"],
    enabled: !!(user?.adminRole && user.adminRole === "full"),
  });

  const approved = rows.filter(r => r.artwork_approved_at);
  const pending = rows.filter(r => !r.artwork_approved_at);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Palette className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Artwork Approvals</h1>
          <p className="text-sm text-muted-foreground">
            All quotes with a WrapGen 3D render linked — sorted by most recent
          </p>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3">
        <Badge variant="secondary" className="gap-1.5 no-default-active-elevate">
          <Clock className="w-3 h-3" />
          {isLoading ? "—" : pending.length} awaiting approval
        </Badge>
        <Badge variant="default" className="bg-accent text-accent-foreground gap-1.5 no-default-active-elevate">
          <CheckCircle className="w-3 h-3" />
          {isLoading ? "—" : approved.length} approved
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No artwork proofs linked yet</p>
            <p className="text-sm mt-1">
              When a WrapGen preview URL is saved against a quote, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Linked Previews</CardTitle>
            <CardDescription>Click any row to open the quote</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {rows.map(row => (
                <div
                  key={row.id}
                  className="flex items-center gap-4 px-6 py-4 hover-elevate"
                  data-testid={`row-artwork-${row.id}`}
                >
                  {/* Status badge */}
                  <div className="shrink-0 w-32">
                    {row.artwork_approved_at ? (
                      <Badge variant="default" className="bg-accent text-accent-foreground no-default-active-elevate gap-1 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="no-default-active-elevate gap-1.5 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        Awaiting
                      </Badge>
                    )}
                  </div>

                  {/* Customer + van + wrap type */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`text-customer-${row.id}`}>
                      {row.user_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {vanLabel(row)}
                      {row.wrap_type_name && (
                        <span className="ml-1.5 text-muted-foreground/70">· {row.wrap_type_name}</span>
                      )}
                    </p>
                  </div>

                  {/* Dates */}
                  <div className="text-xs text-muted-foreground text-right shrink-0 hidden sm:block">
                    {row.artwork_approved_at ? (
                      <>
                        <p className="font-medium text-foreground">
                          {new Date(row.artwork_approved_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                        </p>
                        <p>by {row.artwork_approved_by ?? "customer"}</p>
                      </>
                    ) : (
                      <>
                        <p>
                          Sent {new Date(row.wrapgen_proof_sent_at ?? row.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                        </p>
                        <p className="text-yellow-500">Pending</p>
                      </>
                    )}
                  </div>

                  {/* Preview link */}
                  <a
                    href={row.wrapgen_preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="shrink-0"
                    data-testid={`link-preview-${row.id}`}
                  >
                    <Button size="icon" variant="outline">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>

                  {/* Quote link */}
                  <Link href={`/admin/quotes/${row.id}?tab=configuration`}>
                    <Button size="sm" variant="outline" data-testid={`button-open-quote-${row.id}`}>
                      Open Quote
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
