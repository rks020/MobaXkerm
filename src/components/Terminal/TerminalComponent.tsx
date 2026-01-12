import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

// Aliases removed
// const XTerm = Terminal;
// const XFitAddon = FitAddon;
// const XWebLinksAddon = WebLinksAddon;


interface SessionConfig {
    type: 'ssh' | 'local';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
}

interface TerminalComponentProps {
    id?: string;
    config?: SessionConfig;
    onTitleChange?: (title: string) => void;
}

export function TerminalComponent({ id = 'default', config, onTitleChange }: TerminalComponentProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const pidRef = useRef<number | null>(null);

    const [connState, setConnState] = useState<{ status: 'connecting' | 'connected' | 'error', message?: string }>({ status: 'connecting' });

    useEffect(() => {
        if (!terminalRef.current) return;

        // Reset state on new config
        setConnState({ status: 'connecting' });

        // Initialize xterm
        const term = new Terminal({
            cursorBlink: true,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            theme: {
                background: '#09090b', // Matches gray-950
                foreground: '#e4e4e7', // Matches gray-200
                cursor: '#ffffff',
                selectionBackground: '#3b82f64d', // Blue-500 with opacity
                selectionForeground: '#ffffff',
            },
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Request creation
        const ipc = (window as any).ipcRenderer;
        const isSSH = config?.type === 'ssh';

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            // Small delay to ensure container is resized
            setTimeout(() => fitAddon.fit(), 50);
        });
        resizeObserver.observe(terminalRef.current);

        if (isSSH) {
            const sessionId = id;
            console.log(`[Terminal] Setting up SSH listeners for ${sessionId}`);

            // Listen for SSH events
            ipc.on(`ssh-output-${sessionId}`, (_: any, data: string) => term.write(data));
            ipc.on(`ssh-ready-${sessionId}`, () => {
                console.log(`[Terminal] SSH Ready: ${sessionId}`);
                setConnState({ status: 'connected' });
                term.write('\r\n[SSH Connection Established]\r\n');
                term.focus();
            });
            ipc.on(`ssh-error-${sessionId}`, (_: any, err: string) => {
                console.error(`[Terminal] SSH Error: ${sessionId}`, err);
                setConnState({ status: 'error', message: err });
                term.write(`\r\n[SSH Error]: ${err}\r\n`);
            });
            ipc.on(`ssh-close-${sessionId}`, () => {
                console.log(`[Terminal] SSH Close: ${sessionId}`);
                term.write('\r\n[SSH Connection Closed]\r\n');
            });

            term.onData(data => ipc.send(`ssh-input-${sessionId}`, data));
            term.onResize(({ cols, rows }) => ipc.send(`ssh-resize-${sessionId}`, cols, rows));

            term.write(`\r\nConnecting to ${config.host}...\r\n`);
            console.log(`[Terminal] Sending ssh-connect for ${sessionId}`);
            ipc.send('ssh-connect', { id: sessionId, ...config });

            return () => {
                console.log(`[Terminal] Cleaning up SSH listeners for ${sessionId}`);
                term.dispose();
                ipc.send('ssh-disconnect', sessionId);
                ipc.removeAllListeners(`ssh-output-${sessionId}`);
                ipc.removeAllListeners(`ssh-ready-${sessionId}`);
                ipc.removeAllListeners(`ssh-error-${sessionId}`);
                ipc.removeAllListeners(`ssh-close-${sessionId}`);
                resizeObserver.disconnect();
            };
        } else {
            // LOCAL PTY LOGIC
            console.log('[Terminal] Initializing Local PTY');

            // Listen for created PTY
            const handleCreated = (_event: any, pid: number) => {
                console.log(`[Terminal] Local PTY Created: ${pid}`);
                setConnState({ status: 'connected' });
                pidRef.current = pid;

                const { cols, rows } = term;
                ipc.send('terminal-resize', pid, cols, rows);

                ipc.on(`terminal-output-${pid}`, (_event: any, data: string) => {
                    term.write(data);
                });

                term.onData(data => {
                    ipc.send('terminal-input', pid, data);
                });

                term.onResize(({ cols, rows }) => {
                    ipc.send('terminal-resize', pid, cols, rows);
                });

                term.focus();
            };

            ipc.on('terminal-created', handleCreated);
            console.log('[Terminal] Sending terminal-create');
            ipc.send('terminal-create', term.cols, term.rows);

            // Safety timeout for local terminal
            const timeoutId = setTimeout(() => {
                if (connState.status === 'connecting') {
                    console.error('[Terminal] Local connection timed out');
                    setConnState({
                        status: 'error',
                        message: 'Local shell failed to start. Timed out waiting for PTY.'
                    });
                }
            }, 5000);

            return () => {
                console.log('[Terminal] Cleaning up Local PTY');
                clearTimeout(timeoutId);
                term.dispose();
                ipc.off('terminal-created', handleCreated);
                if (pidRef.current) {
                    // ipc.send('terminal-kill', pidRef.current);
                    ipc.removeAllListeners(`terminal-output-${pidRef.current}`);
                }
                resizeObserver.disconnect();
            };
        }
    }, [config]); // Re-run if config changes (though usually creates new instance)

    return (
        <div className="relative w-full h-full bg-[#09090b]">
            <div className="w-full h-full" ref={terminalRef} />

            {/* Loading Overlay */}
            {connState.status === 'connecting' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                    <span className="text-blue-400 font-medium animate-pulse">
                        {config?.type === 'ssh' ? `Connecting to ${config.host}...` : 'Starting Local Shell...'}
                    </span>
                    <button
                        onClick={() => setConnState({ status: 'error', message: 'Cancelled by user' })}
                        className="mt-4 px-3 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Error Overlay */}
            {connState.status === 'error' && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b]/95 backdrop-blur-md p-6">
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 ring-1 ring-red-500/20">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </div>
                    <h3 className="text-red-400 font-bold text-lg mb-2">Connection Failed</h3>
                    <p className="text-gray-400 text-center max-w-sm mb-6">{connState.message || 'An unknown error occurred'}</p>
                    <button
                        onClick={() => {
                            setConnState({ status: 'connecting' });
                            // Trigger reconnect logic? 
                            // Currently requires re-mounting or calling ssh-connect again.
                            // Ideally, we should just let the effect re-run if we could, but easier to just close tab.
                            // For now, let's just reset state, which might not be enough if effect doesn't re-fire?
                            // Actually, effect depends on [config].
                            // We need to re-trigger the connect logic. 
                            // The simplest way without refactoring is to alert user or just re-send the connect IPC if we refactor `connect` into a function.
                            // But for now, let's assumes user will close tab. 
                            // Wait, "Retry" button implies retry.
                            // Let's reload the window? No.
                            // Let's just say "Close" for now or fix retry logic later.
                            // Refactoring to allow retry:
                            const ipc = (window as any).ipcRenderer;
                            if (config?.type === 'ssh') {
                                setConnState({ status: 'connecting' });
                                ipc.send('ssh-connect', { id: id, ...config });
                            }
                        }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors border border-white/5"
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );

}
