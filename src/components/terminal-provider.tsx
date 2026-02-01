'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Terminal } from '@stripe/terminal-js';

type ConnectionStatus = 'not_connected' | 'connecting' | 'connected';

interface TerminalContextType {
  terminal: Terminal | null;
  isSimulator: boolean;
  isConnected: boolean;
  error: string | null;
}

const TerminalContext = createContext<TerminalContextType>({
  terminal: null,
  isSimulator: false,
  isConnected: false,
  error: null,
});

export function useTerminal() {
  return useContext(TerminalContext);
}

interface TerminalProviderProps {
  children: ReactNode;
}

/**
 * Stripe Terminal Provider
 *
 * Initializes the Stripe Terminal SDK and manages the connection
 * to a reader (simulated or real).
 *
 * To use the simulator:
 * 1. Install Stripe CLI
 * 2. Run: stripe terminal simulator start
 * 3. The SDK will connect to the simulated reader
 */
export function TerminalProvider({ children }: TerminalProviderProps) {
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [isSimulator, setIsSimulator] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let terminalInstance: Terminal | null = null;

    async function initTerminal() {
      try {
        // Load Stripe Terminal SDK dynamically to avoid SSR issues
        const { loadStripeTerminal } = await import('@stripe/terminal-js');
        const StripeTerminal = await loadStripeTerminal();

        if (!StripeTerminal || !mounted) {
          return;
        }

        // Initialize Terminal SDK
        terminalInstance = StripeTerminal.create({
          onFetchConnectionToken: async () => {
            // Fetch a new connection token when needed
            const response = await fetch('/api/terminal/connection-token', {
              method: 'POST',
            });
            if (!response.ok) {
              throw new Error('Failed to fetch connection token');
            }
            const data = await response.json();
            return data.secret;
          },
          onConnectionStatusChange: (status) => {
            if (!mounted) return;
            console.log('Connection status:', status);
            // status is a ConnectionStatusEvent object with a 'status' property
            const statusValue = typeof status === 'string' ? status : (status as any).status;
            if (statusValue === 'connected') {
              setIsConnected(true);
              setError(null);
            } else {
              setIsConnected(false);
            }
          },
          onPaymentStatusChange: (status) => {
            console.log('Payment status:', status);
          },
          onUnexpectedReaderDisconnect: () => {
            if (!mounted) return;
            console.log('Reader unexpectedly disconnected');
            setIsConnected(false);
            setError('Reader disconnected. Please refresh to reconnect.');
          },
        });

        // Discover readers (simulator or real)
        const config = {
          simulated: true,
        };

        const discoverResult = await terminalInstance.discoverReaders(config);

        if (!mounted) return;

        // Check for error using type guard
        if ('error' in discoverResult) {
          throw new Error(discoverResult.error.message);
        }

        console.log('Discovered readers:', discoverResult.discoveredReaders?.length);

        if (discoverResult.discoveredReaders && discoverResult.discoveredReaders.length > 0) {
          // Connect to the first available reader (simulator)
          const connectResult = await terminalInstance.connectReader(
            discoverResult.discoveredReaders[0]
          );

          if (!mounted) return;

          if ('error' in connectResult) {
            throw new Error(connectResult.error.message);
          }

          const readerType = discoverResult.discoveredReaders[0].device_type;
          // DeviceType is an enum, 'simulated' corresponds to a specific value
          setIsSimulator(String(readerType).includes('simulated'));
        } else {
          setError('No readers found. Make sure the Stripe simulator is running.');
        }

        if (mounted) {
          setTerminal(terminalInstance);
        }
      } catch (err) {
        if (!mounted) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize terminal';
        setError(errorMessage);
        console.error('Terminal initialization error:', err);
      }
    }

    initTerminal();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (terminalInstance) {
        terminalInstance.disconnectReader().catch(console.error);
      }
    };
  }, []);

  return (
    <TerminalContext.Provider value={{ terminal, isSimulator, isConnected, error }}>
      {children}
    </TerminalContext.Provider>
  );
}
