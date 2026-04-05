'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
          <div className="text-4xl">😵</div>
          <h2 className="text-xl font-semibold text-gray-800">
            문제가 발생했습니다
          </h2>
          <p className="text-sm text-gray-500">
            페이지를 새로고침 해주세요
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="rounded-lg bg-[var(--color-primary)] px-6 py-2 text-white hover:bg-[var(--color-primary-hover)]"
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
