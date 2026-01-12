import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden', // Hide title bar for custom macOS look
    trafficLightPosition: { x: 10, y: 12 },
    vibrancy: 'under-window', // Minimal vibrancy effect
    visualEffectState: 'active',
    backgroundColor: '#00000000', // Transparent bg for vibrancy to show
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

import { ipcMain } from 'electron'
import os from 'os'

// node-pty must be required to avoid ESM issues with native modules
const pty = require('node-pty')

const shells = new Map<number, any>()

ipcMain.on('terminal-create', (event, cols, rows) => {
  // Robust shell detection for macOS/Linux
  let shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/zsh');

  // Fallback if SHELL env is not set or valid on macOS
  if (os.platform() === 'darwin' && (!shell || shell.trim() === '')) {
    shell = '/bin/zsh';
  }

  console.log('Spawning shell:', shell);
  console.log('ENV keys length:', Object.keys(process.env).length);

  try {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' }, // Merge env explicitly
    });

    const pid = ptyProcess.pid;
    shells.set(pid, ptyProcess);
    event.sender.send('terminal-created', pid);

    ptyProcess.onData((data: string) => {
      if (!win || win.isDestroyed()) return
      win.webContents.send(`terminal-output-${pid}`, data);
    });

    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      console.log(`PTY ${pid} exited with code ${exitCode} signal ${signal}`);
      shells.delete(pid);
      if (!win || win.isDestroyed()) return
      win.webContents.send(`terminal-exit-${pid}`)
    })

    event.sender.send('terminal-created', pid)
  } catch (err: any) {
    console.error('Failed to spawn PTY:', err);
    // If zsh failed, try /bin/sh as a fallback
    if (shell !== '/bin/sh') {
      try {
        console.log('Attempting fallback to /bin/sh');
        const fallbackPty = pty.spawn('/bin/sh', [], {
          name: 'xterm-256color',
          cols: cols || 80,
          rows: rows || 24,
          cwd: os.homedir(),
          env: process.env
        });
        const fbPid = fallbackPty.pid;
        shells.set(fbPid, fallbackPty);
        event.sender.send('terminal-created', fbPid);

        fallbackPty.onData((data: string) => {
          if (!win || win.isDestroyed()) return
          win.webContents.send(`terminal-output-${fbPid}`, data);
        });

        fallbackPty.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
          shells.delete(fbPid);
          if (!win || win.isDestroyed()) return
          win.webContents.send(`terminal-exit-${fbPid}`)
        });

        return;
      } catch (fbErr) {
        console.error('Fallback failed:', fbErr);
      }
    }
  }
});

ipcMain.on('terminal-input', (_event, pid, data) => {
  const ptyProcess = shells.get(pid)
  if (ptyProcess) {
    ptyProcess.write(data)
  }
})

// ... existing PTY logic ...

// SSH Logic
import { Client } from 'ssh2';

const sshSessions = new Map<string, Client>();

ipcMain.on('ssh-connect', (event, { id, host, port, username, password }) => {
  console.log(`[SSH] Initiating connection to ${host}:${port} with user ${username}`);

  // Cleanup existing session if any (e.g. on Retry)
  const existing = sshSessions.get(id);
  if (existing) {
    console.log(`[SSH] Cleaning up existing session for ${id} before reconnect`);
    existing.end();
    sshSessions.delete(id);
  }

  const conn = new Client();

  conn.on('ready', () => {
    console.log(`[SSH] Connection ready for ${id}`);
    event.sender.send(`ssh-ready-${id}`);

    conn.shell((err: Error | undefined, stream: any) => {
      if (err) {
        console.error(`[SSH] Shell error for ${id}:`, err);
        event.sender.send(`ssh-error-${id}`, err.message);
        return conn.end();
      }

      console.log(`[SSH] Shell stream created for ${id}`);

      // We can map 'ssh-input-{id}' to this stream
      // Remove prev listeners first just in case
      ipcMain.removeAllListeners(`ssh-input-${id}`);
      ipcMain.removeAllListeners(`ssh-resize-${id}`);

      ipcMain.on(`ssh-input-${id}`, (_, data) => {
        stream.write(data);
      });

      ipcMain.on(`ssh-resize-${id}`, (_, cols, rows) => {
        stream.setWindow(rows, cols, 0, 0);
      });

      stream.on('close', () => {
        console.log(`[SSH] Stream closed for ${id}`);
        conn.end();
        if (!win || win.isDestroyed()) return;
        event.sender.send(`ssh-close-${id}`);
        ipcMain.removeAllListeners(`ssh-input-${id}`);
        ipcMain.removeAllListeners(`ssh-resize-${id}`);
      }).on('data', (data: any) => {
        if (!win || win.isDestroyed()) return;
        event.sender.send(`ssh-output-${id}`, data.toString());
      });
    });
  }).on('error', (err: any) => {
    console.error(`[SSH] Connection error for ${id}:`, err);
    event.sender.send(`ssh-error-${id}`, err.message);
  }).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
    console.log('[SSH] Keyboard-interactive auth requested');
    // Auto-respond with password if prompts exist
    if (prompts.length > 0 && password) {
      finish([password]);
    } else {
      finish([]);
    }
  }).connect({
    host,
    port: port || 22,
    username,
    password,
    tryKeyboard: true, // Try keyboard-interactive if password fails
    readyTimeout: 30000,
    keepaliveInterval: 10000, // Send keepalive every 10s
    compress: false, // Disable compression to avoid 'Bad packet length'
    // debug: (msg) => console.log(`[SSH DEBUG ${id}]`, msg), // Debug logging disabled for performance
    algorithms: {
      kex: [
        "diffie-hellman-group1-sha1",
        "ecdh-sha2-nistp256",
        "ecdh-sha2-nistp384",
        "ecdh-sha2-nistp521",
        "diffie-hellman-group-exchange-sha256",
        "diffie-hellman-group14-sha1",
        "diffie-hellman-group-exchange-sha1",
        "diffie-hellman-group1-sha1"
      ],
      cipher: [
        "aes128-ctr",
        "aes192-ctr",
        "aes256-ctr",
        "aes128-gcm",
        "aes128-gcm@openssh.com",
        "aes256-gcm",
        "aes256-gcm@openssh.com",
        "aes256-cbc",
        "aes192-cbc",
        "aes128-cbc",
        "3des-cbc"
      ],
      hmac: [
        "hmac-sha2-256",
        "hmac-sha2-512",
        "hmac-sha1",
        "hmac-md5",
        "hmac-sha2-256-etm@openssh.com",
        "hmac-sha2-512-etm@openssh.com",
        "hmac-sha1-etm@openssh.com"
      ]
    }
  });

  sshSessions.set(id, conn);
});

ipcMain.on('ssh-disconnect', (_event, id) => {
  const conn = sshSessions.get(id);
  if (conn) {
    conn.end();
    sshSessions.delete(id);
  }
});

ipcMain.on('sftp-list', (event, { id, path }) => {
  const conn = sshSessions.get(id);
  if (!conn) {
    event.sender.send(`sftp-error-${id}`, 'Connection not found');
    return;
  }

  conn.sftp((err: Error | undefined, sftp: any) => {
    if (err) {
      console.error(`[SFTP] Init error for ${id}:`, err);
      event.sender.send(`sftp-error-${id}`, err.message);
      return;
    }

    sftp.readdir(path || '.', (err: Error | undefined, list: any[]) => {
      if (err) {
        console.error(`[SFTP] Readdir error for ${id}:`, err);
        event.sender.send(`sftp-error-${id}`, err.message);
        sftp.end();
        return;
      }

      const files = list.map(item => ({
        name: item.filename,
        longname: item.longname,
        attrs: item.attrs
      }));
      event.sender.send(`sftp-list-${id}`, files);
      sftp.end();
    });
  });
});

ipcMain.on('sftp-upload', (event, { id, localPath, remotePath }) => {
  const conn = sshSessions.get(id);
  if (!conn) {
    event.sender.send(`sftp-upload-done-${id}`, 'Connection not found');
    return;
  }

  const filename = path.basename(localPath);
  // Construct remote path correctly. If remotePath is '.', use standard linux path.
  // Assuming remotePath is a directory.
  const targetPath = remotePath === '.' ? filename : `${remotePath}/${filename}`;

  console.log(`[SFTP] Uploading ${localPath} to ${targetPath}`);

  conn.sftp((err: Error | undefined, sftp: any) => {
    if (err) {
      console.error(`[SFTP] Upload init error:`, err);
      event.sender.send(`sftp-upload-done-${id}`, err.message);
      return;
    }

    sftp.fastPut(localPath, targetPath, (err: Error | undefined) => {
      if (err) {
        console.error(`[SFTP] Upload error:`, err);
        event.sender.send(`sftp-upload-done-${id}`, err.message);
      } else {
        console.log(`[SFTP] Upload success`);
        event.sender.send(`sftp-upload-done-${id}`); // Success
      }
      sftp.end();
    });
  });
});

