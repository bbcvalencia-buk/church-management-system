import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600">
                            <AlertCircle size={40} />
                        </div>

                        <h1 className="text-2xl font-black text-gray-900 mb-2">Something went wrong</h1>
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                            An unexpected error occurred in the application. We've been notified and are working on a fix.
                        </p>

                        {import.meta.env.DEV && this.state.error && (
                            <div className="mb-8 p-4 bg-gray-100 rounded-xl text-left overflow-auto max-h-40">
                                <p className="text-xs font-mono text-red-600 whitespace-pre-wrap">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-[#2563eb] hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                            >
                                <RefreshCw size={18} />
                                Reload Application
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                            >
                                <Home size={18} />
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
