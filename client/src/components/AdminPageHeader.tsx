interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  statusIndicator?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  description,
  actions,
  badge,
  statusIndicator,
}: AdminPageHeaderProps) {
  return (
    <div className="border-b border-border/60 bg-card/20">
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {badge}
            </div>
            {(description || statusIndicator) && (
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
                {statusIndicator}
              </div>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
