const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let activeProcess;
function pythonPath() { const p = app.isPackaged ? path.join(process.resourcesPath, 'engine', 'Scripts', 'python.exe') : path.join(app.getAppPath(), '.venv', 'Scripts', 'python.exe'); return process.env.STEM_LOCAL_PYTHON || (fs.existsSync(p) ? p : 'python'); }

function stemFolderName(trackPath) {
  return `${path.parse(trackPath).name}_stems`;
}

function moveResults(outputDir, model, tracks) {
  const modelFolder = path.join(outputDir, model);
  if (!fs.existsSync(modelFolder)) return;
  for (const track of tracks) {
    const source = path.join(modelFolder, path.parse(track).name);
    if (!fs.existsSync(source)) continue;
    const desired = path.join(outputDir, stemFolderName(track));
    let destination = desired;
    let index = 2;
    while (fs.existsSync(destination)) destination = `${desired} (${index++})`;
    fs.renameSync(source, destination);
  }
  if (fs.existsSync(modelFolder) && fs.readdirSync(modelFolder).length === 0) fs.rmdirSync(modelFolder);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 880,
    minHeight: 620,
    backgroundColor: '#101018',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('pick-audio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecciona una canción',
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'aiff'] }]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('pick-output', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Elige la carpeta de destino', properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('read-track', async (_, filePath) => {
  // Solo se leen archivos seleccionados explícitamente por la persona usuaria.
  return fs.readFile(filePath);
});

ipcMain.handle('open-folder', (_, folder) => shell.openPath(folder));
ipcMain.handle('engine-info', () => new Promise(resolve => {
  const probe = spawn(pythonPath(), ['-c', "import torch; print('cuda' if torch.cuda.is_available() else 'cpu')"], { windowsHide: true }); let out = '';
  probe.stdout.on('data', d => out += d); probe.on('close', () => resolve({ device: out.trim() === 'cuda' ? 'cuda' : 'cpu' })); probe.on('error', () => resolve({ device: 'cpu' }));
}));

ipcMain.handle('separate', (_, { tracks, outputDir, profile, twoStems, device }) => {
  if (activeProcess) return { started: false, error: 'Ya hay una separación en curso.' };
  if (!tracks?.length || !outputDir) return { started: false, error: 'Selecciona canciones y una carpeta de destino.' };

  // Prioriza el entorno local del proyecto y permite sobrescribirlo para instalaciones empaquetadas.
  const python = pythonPath();
  const model = profile === 'electronic' ? 'htdemucs_ft' : 'htdemucs';
  const args = ['-m', 'demucs', '--name', model, '--out', outputDir, '--device', device || 'cpu'];
  if (profile === 'fast') args.push('--shifts', '0', '--overlap', '0.1');
  if (profile === 'electronic') args.push('--shifts', '2');
  if (twoStems) args.push('--two-stems', twoStems);
  args.push(...tracks);
  activeProcess = spawn(python, args, { windowsHide: true });

  activeProcess.stdout.on('data', data => mainWindow?.webContents.send('separation-log', data.toString()));
  activeProcess.stderr.on('data', data => mainWindow?.webContents.send('separation-log', data.toString()));
  activeProcess.on('error', error => {
    mainWindow?.webContents.send('separation-done', { ok: false, message: `No se pudo iniciar Demucs: ${error.message}` });
    activeProcess = undefined;
  });
  activeProcess.on('close', code => {
    let message = code === 0 ? 'Separación terminada.' : `Demucs terminó con código ${code}. Revisa el registro.`;
    if (code === 0) {
      try { moveResults(outputDir, model, tracks); }
      catch (error) { message = `Separación terminada, pero no se pudo ordenar la carpeta: ${error.message}`; }
    }
    mainWindow?.webContents.send('separation-done', {
      ok: code === 0,
      message
    });
    activeProcess = undefined;
  });
  return { started: true };
});

ipcMain.handle('cancel-separation', () => {
  if (!activeProcess) return false;
  activeProcess.kill();
  return true;
});
