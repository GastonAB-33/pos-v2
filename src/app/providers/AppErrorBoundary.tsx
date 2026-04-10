import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Error inesperado",
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Mantener log visible en consola para debug durante desarrollo.
    // eslint-disable-next-line no-console
    console.error("App render error:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
          <section className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-panel">
            <h1 className="text-xl font-semibold text-red-700">Se produjo un error al renderizar</h1>
            <p className="mt-2 text-sm text-slate-700">
              {this.state.message || "No se pudo cargar la aplicacion."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Recargar
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

