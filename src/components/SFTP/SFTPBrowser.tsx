import { useState, useEffect } from 'react';
import { Folder, File, ArrowUp } from 'lucide-react';

interface FileEntry {
    name: string;
    longname: string;
    attrs: any;
}

interface SFTPBrowserProps {
    sessionId: string;
    isActive: boolean;
}

export function SFTPBrowser({ sessionId, isActive }: SFTPBrowserProps) {
    const [cwd, setCwd] = useState('.');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pathInput, setPathInput] = useState('.');

    useEffect(() => {
        if (!isActive || !sessionId) return;

        // Wait 2 seconds for SSH to be fully ready before requesting SFTP
        const timer = setTimeout(() => {
            loadPath('.');
        }, 2000);

        return () => clearTimeout(timer);
    }, [sessionId, isActive]);

    const loadPath = (path: string) => {
        setLoading(true);
        setError(null);
        const ipc = (window as any).ipcRenderer;

        // Setup listeners
        const handleList = (_: any, list: FileEntry[]) => {
            setFiles(list.sort((a, b) => {
                const aIsDir = a.longname.startsWith('d');
                const bIsDir = b.longname.startsWith('d');
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.name.localeCompare(b.name);
            }));
            setLoading(false);
            setCwd(path);
            setPathInput(path);
            cleanup();
        };

        const handleError = (_: any, msg: string) => {
            setError(msg);
            setLoading(false);
            cleanup();
        };

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            ipc.removeAllListeners(`sftp-list-${sessionId}`);
            ipc.removeAllListeners(`sftp-error-${sessionId}`);
        };

        // Add timeout for SFTP requests
        const timeoutId = setTimeout(() => {
            handleError(null, 'Request timed out. SSH connection may not support SFTP or is still initializing.');
        }, 10000);

        ipc.on(`sftp-list-${sessionId}`, handleList);
        ipc.on(`sftp-error-${sessionId}`, handleError);

        ipc.send('sftp-list', { id: sessionId, path });

        return cleanup;
    };

    const navigate = (folderName: string) => {
        const newPath = cwd === '.' ? folderName : `${cwd}/${folderName}`;
        loadPath(newPath);
    };

    const goUp = () => {
        if (cwd === '.' || cwd === '/') return;
        const parts = cwd.split('/');
        parts.pop();
        const newPath = parts.join('/') || '/';
        loadPath(newPath);
    };

    const handlePathSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pathInput.trim()) {
            loadPath(pathInput);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files[0];
        if (!file) return;

        // In Electron, File object has 'path' property
        const localPath = (file as any).path;
        if (!localPath) return;

        const ipc = (window as any).ipcRenderer;
        setLoading(true);
        setError(null);

        // Upload to current cwd
        ipc.send('sftp-upload', { id: sessionId, localPath, remotePath: cwd });

        // Listen for completion (one-off)
        const handleUploadFinish = (_: any, err?: string) => {
            setLoading(false);
            if (err) setError(err);
            else loadPath(cwd); // Refresh
            ipc.removeAllListeners(`sftp-upload-done-${sessionId}`);
        };
        ipc.on(`sftp-upload-done-${sessionId}`, handleUploadFinish);
    };

    if (!isActive) return <div className="p-8 text-center text-gray-600 text-xs">Waiting for connection...</div>;

    return (
        <div className="flex flex-col h-full bg-transparent text-gray-300 text-xs font-medium">
            {/* Address Bar */}
            <div className="p-3 border-b border-white/5 bg-white/5 mx-2 my-2 rounded-lg flex items-center gap-2 shadow-inner shadow-black/20">
                <button
                    onClick={goUp}
                    className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={cwd === '.' || cwd === '/'}
                    title="Go Up"
                >
                    <ArrowUp size={14} />
                </button>
                <form onSubmit={handlePathSubmit} className="flex-1 bg-black/20 rounded px-2 py-1 border border-white/5 flex items-center">
                    <Folder size={12} className="text-gray-500 mr-2" />
                    <input
                        type="text"
                        value={pathInput}
                        onChange={(e) => setPathInput(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:outline-none text-blue-400 truncate"
                        placeholder="Enter path and press Enter"
                    />
                </form>
            </div>

            {/* File List */}
            <div
                className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {loading && (
                    <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading...
                    </div>
                )}

                {/* ... error & list ... */}
                {error && (
                    <div className="p-4 m-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                        Error: {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="flex flex-col gap-0.5">
                        {files.map((file, idx) => {
                            const isDir = file.longname.startsWith('d');
                            if (file.name === '.' || file.name === '..') return null;

                            return (
                                <div
                                    key={idx}
                                    className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer whitespace-nowrap transition-colors select-none"
                                    onDoubleClick={() => isDir && navigate(file.name)}
                                >
                                    <div className="min-w-[16px]">
                                        {isDir
                                            ? <Folder size={14} className="text-blue-400 fill-blue-400/20" />
                                            : <File size={14} className="text-gray-500 group-hover:text-gray-400" />
                                        }
                                    </div>
                                    <span className={`truncate ${isDir ? 'text-gray-200' : 'text-gray-400'}`}>{file.name}</span>
                                </div>
                            );
                        })}
                        {files.length === 0 && <div className="p-4 text-center text-gray-600 italic">Empty directory (Drag files here to upload)</div>}
                    </div>
                )}
            </div>
        </div>
    );
}
