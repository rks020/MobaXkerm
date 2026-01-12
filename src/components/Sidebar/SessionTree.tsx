import { useState, useEffect } from 'react';
import { ChevronDown, Folder, Terminal, Server, Trash2, Copy, Plus, FolderPlus, Edit } from 'lucide-react';
import { SavedSession } from '../../lib/sessionStore';

interface SessionTreeProps {
    sessions: SavedSession[];
    onConnect: (session: SavedSession) => void;
    onDelete: (id: string) => void;
    onNewConnection?: (parentId: string) => void;
    onNewFolder?: (parentId: string) => void;
    onDuplicate?: (session: SavedSession) => void;
    onRename?: (session: SavedSession) => void;
    onMoveSession?: (sessionId: string, newParentId: string | null) => void;
    level?: number;
}

export function SessionTree({ sessions, onConnect, onDelete, onNewConnection, onNewFolder, onDuplicate, onRename, onMoveSession, level = 0 }: SessionTreeProps) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: SavedSession } | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const toggleFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expanded);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpanded(newExpanded);
    };

    const handleContextMenu = (e: React.MouseEvent, node: SavedSession) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, node: SavedSession) => {
        if (node.type === 'folder') return; // Don't allow dragging folders
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('sessionId', node.id);
        setDraggedId(node.id);
    };

    const handleDragOver = (e: React.DragEvent, node: SavedSession) => {
        if (node.type !== 'folder') return; // Only allow dropping on folders
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(node.id);
    };

    const handleDragLeave = () => {
        setDragOverId(null);
    };

    const handleDrop = (e: React.DragEvent, targetFolder: SavedSession) => {
        e.preventDefault();
        e.stopPropagation();
        const sessionId = e.dataTransfer.getData('sessionId');
        if (sessionId && onMoveSession && targetFolder.type === 'folder') {
            onMoveSession(sessionId, targetFolder.id);
        }
        setDraggedId(null);
        setDragOverId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverId(null);
    };

    if (sessions.length === 0 && level === 0) {
        return <div className="text-xs text-gray-600 px-4 italic py-2">No saved sessions</div>;
    }

    return (
        <div className="flex flex-col select-none relative">
            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 w-48 bg-[#18181b] border border-white/10 rounded-lg shadow-xl py-1 text-sm text-gray-300 backdrop-blur-md"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()} // Prevent closing immediately when clicking inside
                >
                    {contextMenu.node.type === 'folder' ? (
                        <>
                            <button
                                onClick={() => {
                                    if (onNewConnection) onNewConnection(contextMenu.node.id);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2"
                            >
                                <Plus size={14} className="text-blue-400" /> New Connection
                            </button>
                            <button
                                onClick={() => {
                                    if (onNewFolder) onNewFolder(contextMenu.node.id);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2"
                            >
                                <FolderPlus size={14} className="text-yellow-400" /> New Folder
                            </button>
                            <div className="h-px bg-white/10 my-1" />
                            <button
                                onClick={() => {
                                    onDelete(contextMenu.node.id);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 hover:text-red-400 flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Delete Folder
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    onConnect(contextMenu.node);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2"
                            >
                                <Terminal size={14} className="text-emerald-400" /> Connect
                            </button>
                            <button
                                onClick={() => {
                                    if (onDuplicate) onDuplicate(contextMenu.node);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2"
                            >
                                <Copy size={14} className="text-yellow-400" /> Duplicate
                            </button>
                            <button
                                onClick={() => {
                                    if (onRename) onRename(contextMenu.node);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2"
                            >
                                <Edit size={14} className="text-blue-400" /> Rename
                            </button>
                            <div className="h-px bg-white/10 my-1" />
                            <button
                                onClick={() => {
                                    onDelete(contextMenu.node.id);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 hover:text-red-400 flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </>
                    )}
                </div>
            )}

            {sessions.map(node => {
                const isFolder = node.type === 'folder';
                const isExpanded = expanded.has(node.id);
                const hasChildren = node.children && node.children.length > 0;

                return (
                    <div key={node.id}>
                        <div
                            draggable={!isFolder}
                            className={`
                                group flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors
                                hover:bg-white/5 text-gray-400 hover:text-gray-200
                                ${contextMenu?.node.id === node.id ? 'bg-white/10 text-white' : ''}
                                ${draggedId === node.id ? 'opacity-50' : ''}
                                ${dragOverId === node.id ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : ''}
                            `}
                            style={{ paddingLeft: `${level * 12 + 8}px` }}
                            onClick={(e) => {
                                if (isFolder) toggleFolder(node.id, e);
                                else onConnect(node);
                            }}
                            onContextMenu={(e) => handleContextMenu(e, node)}
                            onDoubleClick={(e) => {
                                if (isFolder) toggleFolder(node.id, e);
                                else onConnect(node);
                            }}
                            onDragStart={(e) => handleDragStart(e, node)}
                            onDragOver={(e) => handleDragOver(e, node)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, node)}
                            onDragEnd={handleDragEnd}
                        >
                            {/* Icon / Expander */}
                            <div className="flex items-center justify-center w-4 h-4 shrink-0 transition-transform duration-200">
                                {isFolder && (
                                    <div className={`opacity-70 hover:opacity-100 transition-opacity ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                        <ChevronDown size={12} />
                                    </div>
                                )}
                            </div>

                            {/* Type Icon */}
                            <div className="shrink-0 text-gray-500 group-hover:text-gray-400">
                                {isFolder ? (
                                    <Folder size={14} className={isExpanded ? 'fill-gray-500/20' : ''} />
                                ) : node.type === 'ssh' ? (
                                    <Server size={14} />
                                ) : (
                                    <Terminal size={14} />
                                )}
                            </div>

                            {/* Name */}
                            <span className="truncate text-xs font-medium flex-1">{node.name}</span>

                            {/* Actions (Hover) */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                {/* Only show basic actions here, advanced in context menu */}
                                {/* ... keeping existing structure if needed, or rely on context menu */}
                            </div>
                        </div>

                        {/* Children (Recursive) */}
                        {isFolder && isExpanded && (
                            <div className="relative">
                                {/* Vertical line for hierarchy */}
                                <div
                                    className="absolute left-[calc(16px+0.5rem)] top-0 bottom-0 w-px bg-white/5"
                                    style={{ left: `${level * 12 + 16}px` }}
                                />

                                {hasChildren ? (
                                    <SessionTree
                                        sessions={node.children!}
                                        onConnect={onConnect}
                                        onDelete={onDelete}
                                        onNewConnection={onNewConnection}
                                        onNewFolder={onNewFolder}
                                        onDuplicate={onDuplicate}
                                        onRename={onRename}
                                        onMoveSession={onMoveSession}
                                        level={level + 1}
                                    />
                                ) : (
                                    <div
                                        className="py-1 text-[10px] text-gray-600 italic select-none"
                                        style={{ paddingLeft: `${(level + 1) * 12 + 28}px` }}
                                    >
                                        Empty folder
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
