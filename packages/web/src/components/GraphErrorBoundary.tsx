import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, FileText, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  attemptedRecovery: boolean;
  copySuccess: boolean;
}

export class GraphErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      attemptedRecovery: false,
      copySuccess: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error in development only
    if (import.meta.env.DEV) {
      console.error('Graph visualization error:', error);
      console.error('Error details:', errorInfo);
    }
    
    this.setState({ errorInfo });
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service like Sentry
      // console.error('Production error logged:', { error, errorInfo });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      attemptedRecovery: true
    });
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  getErrorMessage = (error: Error | null): string => {
    if (!error) return 'An unexpected error occurred';
    
    const message = error.message || error.toString();
    
    // Provide user-friendly messages for common graph errors
    if (message.includes('Cannot read properties of undefined')) {
      return 'Invalid graph data structure detected. Some nodes or edges may be missing required properties.';
    }
    if (message.includes('NaN') || message.includes('Infinity')) {
      return 'Invalid numeric values in graph data. Check node positions and edge weights.';
    }
    if (message.includes('Maximum call stack')) {
      return 'Circular dependency detected in graph data.';
    }
    if (message.includes('d3') || message.includes('force')) {
      return 'Graph rendering engine encountered an error. The data may be incompatible.';
    }
    if (message.includes('null') || message.includes('undefined')) {
      return 'Missing required data in graph structure.';
    }
    
    return `Graph visualization error: ${message}`;
  };

  getSuggestions = (error: Error | null): string[] => {
    const suggestions = [];
    
    if (!error) return ['Try refreshing the page', 'Contact support if the issue persists'];
    
    const message = error.message || '';
    
    if (message.includes('undefined') || message.includes('null')) {
      suggestions.push('Check that all nodes have required fields (id, type, title)');
      suggestions.push('Verify edges reference valid node IDs');
    }
    
    if (message.includes('NaN') || message.includes('Infinity')) {
      suggestions.push('Ensure all numeric values are valid numbers');
      suggestions.push('Check priority values are between 0 and 1');
    }
    
    if (message.includes('force') || message.includes('d3')) {
      suggestions.push('Try reducing the number of nodes/edges');
      suggestions.push('Check for duplicate node IDs');
    }
    
    suggestions.push('View browser console for detailed error information');
    
    if (!this.state.attemptedRecovery) {
      suggestions.push('Click "Try Again" to attempt recovery');
    }
    
    return suggestions;
  };

  copyErrorDetails = async () => {
    const { error, errorInfo } = this.state;
    const errorText = [
      '--- GraphDone Error Report ---',
      `Error: ${error?.message || 'Unknown error'}`,
      `Stack: ${error?.stack || 'No stack trace'}`,
      `Component Stack: ${errorInfo?.componentStack || 'No component stack'}`,
      `Timestamp: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
      `URL: ${window.location.href}`,
      '--- End Report ---'
    ].join('\n');

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copySuccess: true });
      setTimeout(() => {
        this.setState({ copySuccess: false });
      }, 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      console.error('Failed to copy error details:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackComponent) {
        return <>{this.props.fallbackComponent}</>;
      }

      const { error, errorInfo, showDetails, copySuccess } = this.state;
      const errorMessage = this.getErrorMessage(error);
      const suggestions = this.getSuggestions(error);

      return (
        <div className="h-full flex items-center justify-center bg-gray-900 p-4 tropical-lagoon-bg">
          <div className="max-w-2xl w-full">
            <div className="bg-gray-800 border border-red-500/30 rounded-lg shadow-xl">
              {/* Error Header */}
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">
                      Graph Visualization Error
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              <div className="p-6 border-b border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-3">
                  Troubleshooting Suggestions:
                </h4>
                <ul className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <span className="text-green-400 mr-2">•</span>
                      <span className="text-gray-300">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Error Details */}
              {error && (
                <div className="border-b border-gray-700">
                  <button
                    onClick={this.toggleDetails}
                    className="w-full px-6 py-3 flex items-center justify-between text-sm hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-gray-400">Technical Details</span>
                    {showDetails ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  
                  {showDetails && (
                    <div className="px-6 pb-4">
                      <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs">
                        <div className="text-red-400 mb-2">
                          {error.name}: {error.message}
                        </div>
                        {errorInfo && (
                          <div className="text-gray-500 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {errorInfo.componentStack}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="p-6 flex items-center justify-between">
                <button
                  onClick={() => window.location.href = '/'}
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Go to Dashboard
                </button>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      const errorReport = {
                        error: error?.message,
                        stack: error?.stack,
                        component: 'GraphVisualization',
                        timestamp: new Date().toISOString()
                      };
                      if (import.meta.env.DEV) {
                        console.log('Error report:', errorReport);
                      }
                      alert('Error report logged to console');
                    }}
                    className="btn btn-secondary flex items-center"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Report Issue
                  </button>
                  
                  <button
                    onClick={this.copyErrorDetails}
                    className={`btn ${this.state.copySuccess ? 'btn-success' : 'btn-secondary'} flex items-center transition-all duration-200`}
                  >
                    {this.state.copySuccess ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Error
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={this.handleReset}
                    className="btn btn-primary flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Help */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                If this error persists, please contact support with the error details above.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}