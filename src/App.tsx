import { Terminal, Folder, Settings, Plus, X, Globe, Server, Command, FolderPlus, RefreshCw, Copy } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TerminalComponent } from './components/Terminal/TerminalComponent';
import { NewSessionModal } from './components/Session/NewSessionModal';
import { FolderModal } from './components/Session/FolderModal';
import { RenameModal } from './components/Session/RenameModal';
import { SFTPBrowser } from './components/SFTP/SFTPBrowser';
import { exclude } from 'ssh2-sftp-client/src/utils';
import { SessionTree } from './components/Sidebar/SessionTree';
import { sessionStore, SavedSession } from './lib/sessionStore';

// Keep 'Session' for active tabs
interface Session {
  id: string;
  name: string;
  savedId?: string; // ID of the saved session if applicable
  config?: any;
}

function App() {
  const [sessions, setSessions] = useState<Session[]>([
    { id: 'local-1', name: 'Local Terminal', config: { type: 'local' } }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('local-1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | undefined>(undefined);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number, y: number, sessionId: string } | null>(null);

  // Saved Sessions Logic
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Load saved sessions on mount and when refreshed
    const raw = sessionStore.getSessions();
    const tree = sessionStore.buildTree(raw);
    setSavedSessions(tree);
  }, [refreshTrigger]);

  const refreshSessions = () => setRefreshTrigger(prev => prev + 1);

  const handleCreateFolder = (name: string, parentId?: string) => {
    sessionStore.addSession({
      id: crypto.randomUUID(),
      name,
      type: 'folder',
      parentId: parentId || null
    });
    refreshSessions();
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      const all = sessionStore.getSessions().filter(s => s.id !== id);
      sessionStore.saveSessions(all);
      refreshSessions();
    }
  };

  // Connect to a new or saved session
  const handleNewSessionInFolder = (parentId: string) => {
    setTargetParentId(parentId);
    setIsModalOpen(true);
  };

  const [folderParentId, setFolderParentId] = useState<string | undefined>(undefined);

  const handleNewFolderInFolder = (parentId: string) => {
    setFolderParentId(parentId);
    setIsFolderModalOpen(true);
  };

  // Resizable panels state
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [sftpWidth, setSftpWidth] = useState(288);
  const [isResizing, setIsResizing] = useState<'sidebar' | 'sftp' | null>(null);

  useEffect(() => {
    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Cancel previous animation frame if it exists
      if (rafId) cancelAnimationFrame(rafId);

      // Use requestAnimationFrame for smooth updates
      rafId = requestAnimationFrame(() => {
        if (isResizing === 'sidebar') {
          const newWidth = Math.max(200, Math.min(500, e.clientX));
          setSidebarWidth(newWidth);
        } else if (isResizing === 'sftp') {
          const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
          setSftpWidth(newWidth);
        }
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Close tab context menu on click
  useEffect(() => {
    const handleClick = () => setTabContextMenu(null);
    if (tabContextMenu) {
      document.addEventListener('click', handleClick);
    }
    return () => document.removeEventListener('click', handleClick);
  }, [tabContextMenu]);

  const handleNewSession = (config: any, savedId?: string) => {
    const newSession = {
      id: `session-${Date.now()}`,
      name: config.name,
      savedId,
      config
    };
    setSessions(prev => [...prev, newSession]);
    setActiveTabId(newSession.id);
  };

  const handleConnectSaved = (saved: SavedSession) => {
    // If it has config (SSH/Local), connect. If folder, do nothing (handled by tree expand)
    if (saved.type === 'folder') return;

    // Check if already open
    const existing = sessions.find(s => s.savedId === saved.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const config = saved.config || { type: saved.type };
    // Ensure type is set if missing in config
    if (!config.type) config.type = saved.type;

    // For local, minimal config
    if (saved.type === 'local' && !config.name) config.name = saved.name;
    else config.name = saved.name;

    handleNewSession(config, saved.id);
  };

  const handleDuplicateSession = (saved: SavedSession) => {
    const config = saved.config || { type: saved.type };
    if (!config.type) config.type = saved.type;
    if (saved.type === 'local' && !config.name) config.name = saved.name;
    else config.name = saved.name;

    // Force new session by passing savedId (so it's tracked) but skipping the check
    handleNewSession(config, saved.id);
  };

  const closeSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (activeTabId === id && newSessions.length > 0) {
      setActiveTabId(newSessions[newSessions.length - 1].id);
    } else if (activeTabId === id && newSessions.length === 0) {
      setActiveTabId('');
    }
  };

  const handleOpenRename = (session: SavedSession) => {
    setRenameSessionId(session.id);
    setIsRenameModalOpen(true);
  };

  const handleRenameSession = (newName: string) => {
    if (renameSessionId) {
      sessionStore.renameSession(renameSessionId, newName);
      refreshSessions();
    }
  };

  const handleMoveSession = (sessionId: string, newParentId: string | null) => {
    sessionStore.moveSession(sessionId, newParentId);
    refreshSessions();
  };

  const handleReconnectTab = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Close existing terminal
    const ipc = (window as any).ipcRenderer;
    if (session.config?.type === 'ssh') {
      ipc.send('ssh-disconnect', sessionId);
    } else if (session.config?.type === 'local') {
      ipc.send('terminal-input', sessionId, '\x03'); // Send Ctrl+C
    }

    // Create new session with same config
    handleNewSession(session.config, session.savedId);

    // Close old session
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setTabContextMenu(null);
  };

  const handleDuplicateTab = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    handleNewSession(session.config, session.savedId);
    setTabContextMenu(null);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-300 font-sans overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />

      <NewSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleNewSession}
        onSave={refreshSessions}
      />

      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setFolderParentId(undefined);
        }}
        onCreate={handleCreateFolder}
        initialParentId={folderParentId}
      />

      <RenameModal
        isOpen={isRenameModalOpen}
        onClose={() => {
          setIsRenameModalOpen(false);
          setRenameSessionId(null);
        }}
        onRename={handleRenameSession}
        currentName={sessionStore.getSessions().find(s => s.id === renameSessionId)?.name || ''}
      />

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <div
          className="fixed bg-[#1c1c1c] border border-white/10 rounded-lg shadow-2xl py-1 z-50 min-w-[160px]"
          style={{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleReconnectTab(tabContextMenu.sessionId)}
            className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 flex items-center gap-2 text-gray-300"
          >
            <RefreshCw size={14} className="text-emerald-400" /> Reconnect
          </button>
          <button
            onClick={() => handleDuplicateTab(tabContextMenu.sessionId)}
            className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 flex items-center gap-2 text-gray-300"
          >
            <Copy size={14} className="text-yellow-400" /> Duplicate
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="bg-gray-900/90 backdrop-blur-xl border-r border-white/5 flex flex-col relative z-10"
      >
        {/* Header */}
        <div className="h-14 flex items-center pl-20 pr-5 border-b border-white/5 drag-region select-none relative">
          <div className="p-1.5 bg-blue-500/20 rounded-lg mr-3">
            <Terminal size={18} className="text-blue-400" />
          </div>
          <span className="font-bold tracking-tight text-white text-sm">MobaXkerm</span>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">

          {/* Quick Actions */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2">Start</div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all group"
            >
              <Server size={16} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
              New Connection
            </button>
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all group"
            >
              <FolderPlus size={16} className="text-gray-500 group-hover:text-yellow-400 transition-colors" />
              New Folder
            </button>
          </div>

          {/* Saved Sessions (Tree) */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saved Sessions</div>
            </div>
            <SessionTree
              sessions={savedSessions}
              onConnect={handleConnectSaved}
              onDelete={handleDeleteSession}
              onNewConnection={handleNewSessionInFolder}
              onNewFolder={handleNewFolderInFolder}
              onDuplicate={handleDuplicateSession}
              onRename={handleOpenRename}
              onMoveSession={handleMoveSession}
            />
          </div>

          {/* Active Sessions */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-2">Active Tabs</div>
            <div className="space-y-1">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => setActiveTabId(session.id)}
                  className={`relative px-3 py-2.5 rounded-lg cursor-pointer text-sm flex items-center group transition-all duration-200 ${activeTabId === session.id
                    ? 'bg-blue-600/10 text-white shadow-lg shadow-blue-900/20 ring-1 ring-blue-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    }`}
                >
                  {/* Active Indicator */}
                  {activeTabId === session.id && (
                    <div className="absolute left-0 w-1 h-5 bg-blue-500 rounded-r-full" />
                  )}

                  <Folder size={16} className={`mr-3 ${activeTabId === session.id ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                  <span className="truncate flex-1 font-medium">{session.name}</span>

                  <button
                    onClick={(e) => closeSession(e, session.id)}
                    className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${activeTabId === session.id ? 'hover:bg-blue-500/20' : 'hover:bg-white/10'}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-xs text-gray-600 px-3 italic">No sessions active</div>
              )}
            </div>
          </div>
        </div>

        {/* User / Settings Footer (Optional) */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Quick Connect
          </button>
        </div>
      </aside>

      {/* Sidebar Resize Handle */}
      <div
        className={`w-1 bg-transparent hover:bg-blue-500/50 cursor-col-resize transition-colors ${isResizing === 'sidebar' ? 'bg-blue-500' : ''}`}
        onMouseDown={() => setIsResizing('sidebar')}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative z-0">
        {/* Tabs Bar */}
        <div className="h-10 bg-[#09090b] border-b border-white/5 flex items-center px-2 gap-1 overflow-x-auto no-scrollbar pt-2">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => setActiveTabId(session.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setTabContextMenu({ x: e.clientX, y: e.clientY, sessionId: session.id });
              }}
              className={`
                group max-w-[240px] flex-1 min-w-[140px] h-full rounded-t-lg flex items-center px-4 text-xs font-medium border-t border-x relative cursor-pointer select-none transition-all
                ${activeTabId === session.id
                  ? 'bg-[#18181b] border-white/10 text-blue-400 z-10'
                  : 'bg-transparent border-transparent text-gray-500 hover:bg-[#18181b]/50 hover:text-gray-300'
                }
              `}
            >
              {/* Tab Active Top Highlight */}
              {activeTabId === session.id && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}

              <span className="truncate flex-1">{session.name}</span>
              <button
                onClick={(e) => closeSession(e, session.id)}
                className="ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 transition-all"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setIsModalOpen(true)}
            className="h-6 w-6 flex items-center justify-center ml-1 rounded-md hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Terminal Area */}
        <div className="flex-1 relative flex">
          <div className="flex-1 relative overflow-hidden bg-[#09090b]">
            {sessions.map(session => (
              <div key={session.id} className={`w-full h-full absolute inset-0 ${activeTabId === session.id ? 'z-10 visible' : 'z-0 invisible'}`}>
                <TerminalComponent id={session.id} config={session.config} />
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center mb-6 shadow-2xl skew-y-3 ring-1 ring-white/5">
                  <Terminal size={40} className="text-blue-500/50" />
                </div>
                <h2 className="text-xl font-medium text-gray-300 mb-2">Easy Terminal Access</h2>
                <p className="text-gray-500 text-sm max-w-xs text-center mb-8">
                  Connect to local shells or remote SSH servers with built-in SFTP support.
                </p>
                <button onClick={() => setIsModalOpen(true)} className="px-6 py-2 bg-blue-600/10 text-blue-400 rounded-full hover:bg-blue-600/20 transition-colors text-sm font-medium border border-blue-500/20">
                  Get Started
                </button>
              </div>
            )}
          </div>

          {/* SFTP Resize Handle */}
          <div
            className={`w-1 bg-transparent hover:bg-blue-500/50 cursor-col-resize transition-colors ${isResizing === 'sftp' ? 'bg-blue-500' : ''}`}
            onMouseDown={() => setIsResizing('sftp')}
          />

          {/* SFTP Pane */}
          <aside
            style={{ width: `${sftpWidth}px` }}
            className="bg-[#0e0e11] border-l border-white/5 flex flex-col"
          >
            <div className="h-10 flex items-center px-4 border-b border-white/5 bg-[#18181b]/50">
              <Folder size={14} className="text-blue-400 mr-2" />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remote Files</span>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {(() => {
                const activeSession = sessions.find(s => s.id === activeTabId);
                const isSSH = activeSession?.config?.type === 'ssh';

                if (activeSession && isSSH) {
                  return <SFTPBrowser sessionId={activeSession.id} isActive={true} />;
                }
                return (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-600">
                    <Server size={32} className="mb-3 opacity-20" />
                    <p className="text-xs">Connect to an SSH server to view files.</p>
                  </div>
                );
              })()}
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
export default App
