import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * An error boundary component that catches and suppresses hydration errors.
 * Use this to wrap components that are prone to hydration mismatches.
 */
export class HydrationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Check if this is a hydration error
    const isHydrationError = 
      error.message.includes('hydration') || 
      error.message.includes('Hydrate') ||
      error.message.includes('text content did not match');
    
    // Only log non-hydration errors to the console
    if (!isHydrationError) {
      console.error('Error caught by HydrationErrorBoundary:', error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || <div style={{ display: 'none' }}></div>;
    }

    return this.props.children;
  }
} 