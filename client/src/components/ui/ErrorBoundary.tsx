import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: (reset: () => void) => ReactNode;
};

type ErrorBoundaryState = { hasError: boolean };

/** Catches a render error in its children, so one broken block never blanks the page. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    return this.state.hasError
      ? this.props.fallback(this.reset)
      : this.props.children;
  }
}
