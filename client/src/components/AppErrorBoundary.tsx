import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  hasAutoReloaded: boolean;
}

const RELOAD_FLAG = "app_error_boundary_reloaded";

function isChunkLoadError(error: Error): boolean {
  const msg = error?.message ?? "";
  return (
    msg.includes("Importing a module script failed") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Unable to preload CSS") ||
    msg.includes("error loading dynamically imported module") ||
    error?.name === "ChunkLoadError"
  );
}

export default class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const hasAutoReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
    this.state = { hasError: false, error: null, hasAutoReloaded };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("AppErrorBoundary caught:", error, info.componentStack);

    if (isChunkLoadError(error) && !this.state.hasAutoReloaded) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error!);

      return (
        <div className="min-h-screen bg-primary flex flex-col items-center justify-center gap-6 p-8">
          <img
            src="/logo.png"
            alt="Mobile Tyre Vans"
            className="h-16 object-contain opacity-80"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="text-center max-w-md">
            <h1 className="text-white text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6">
              {isChunk
                ? "The app was recently updated. Please reload to get the latest version."
                : "The page failed to load. Please try refreshing — if the problem persists, contact us on "}
              {!isChunk && (
                <a href="tel:08000000000" className="text-accent hover:underline">0800 000 0000</a>
              )}{!isChunk && "."}
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem(RELOAD_FLAG);
                window.location.reload();
              }}
              className="px-6 py-2 bg-accent text-accent-foreground font-semibold rounded-md hover:bg-[#7ab030] transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
