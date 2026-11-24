let tracks = [];
let outputDir = '';
let device = 'cpu', startedAt, clock;
const $ = id => document.getElementById(id);
const setStatus = (message, tone = '') => { $('status').textContent = message; $('status').className = tone; };
const refresh = () => { $('start').disabled = !tracks.length || !outputDir; };
const audioExtensions = /\.(mp3|wav|flac|m4a|ogg|aac|aiff)$/i;

function safeName(file) { return file.split(/[\\/]/).pop(); }
function drawWave(canvas, audioBuffer) {
  const context = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = canvas.clientHeight * devicePixelRatio;
  context.scale(devicePixelRatio, devicePixelRatio);
  const displayWidth = canvas.clientWidth, displayHeight = canvas.clientHeight;
  const data = audioBuffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / displayWidth));
  context.clearRect(0, 0, displayWidth, displayHeight);
  context.strokeStyle = '#bda5ff'; context.lineWidth = 1.4; context.beginPath();
  for (let x = 0; x < displayWidth; x++) {
    let min = 1, max = -1;
    for (let i = 0; i < step; i++) { const v = data[x * step + i] || 0; min = Math.min(min, v); max = Math.max(max, v); }
    context.moveTo(x, (1 + min) * displayHeight / 2); context.lineTo(x, (1 + max) * displayHeight / 2);
  }
  context.stroke();
}
async function renderTrackCard(file, index) {
  const card = document.createElement('article'); card.className = 'track-card';
  const initial = safeName(file).charAt(0).toUpperCase();
  card.innerHTML = `<div class="cover" aria-label="Carátula">${initial}</div><div><strong>${safeName(file)}</strong><small>Preparando información…</small></div><button class="remove" title="Quitar tema">×</button>`;
  $('track-list').append(card);
  try {
    const raw = await window.stemLocal.readTrack(file);
    const audio = await new AudioContext().decodeAudioData(new Uint8Array(raw).buffer);
    card.querySelector('small').textContent = `${Math.round(audio.duration)} s · listo`;
  } catch (_) {
    card.querySelector('small').textContent = 'Track listo para separar';
  }
  card.querySelector('.remove').onclick = () => { tracks = []; $('track-list').innerHTML = '<p class="empty">Selecciona un tema para comenzar.</p>'; refresh(); };
}

$('pick-tracks').onclick = async () => {
  const selected = await window.stemLocal.pickAudio();
  if (!selected.length) return;
  tracks = [selected[0]];
  $('track-list').innerHTML = '';
  tracks.forEach(renderTrackCard);
  setStatus(`${tracks.length} canción${tracks.length === 1 ? '' : 'es'} lista${tracks.length === 1 ? '' : 's'}.`);
  refresh();
};
$('drop-zone').addEventListener('dragover', event => { event.preventDefault(); $('drop-zone').classList.add('dragging'); });
$('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('dragging'));
$('drop-zone').addEventListener('drop', event => {
  event.preventDefault(); $('drop-zone').classList.remove('dragging');
  tracks = [...event.dataTransfer.files].map(window.stemLocal.pathForFile).filter(file => audioExtensions.test(file)).slice(0, 1);
  if (!tracks.length) return setStatus('Suelta archivos de audio compatibles.', 'error');
  $('track-list').innerHTML = ''; tracks.forEach(renderTrackCard); refresh();
  setStatus(`${tracks.length} canción${tracks.length === 1 ? '' : 'es'} lista${tracks.length === 1 ? '' : 's'}.`);
});
$('pick-output').onclick = async () => {
  const selected = await window.stemLocal.pickOutput();
  if (!selected) return;
  outputDir = selected; $('output-path').textContent = selected; refresh();
};
$('start').onclick = async () => {
  const result = await window.stemLocal.separate({ tracks, outputDir, profile: $('profile').value, twoStems: $('stem-mode').value, device });
  if (!result.started) return setStatus(result.error, 'error');
  $('start').hidden = true; $('cancel').hidden = false; $('log').textContent = ''; $('technical').open = true; $('technical-state').textContent = '· en directo'; startedAt = Date.now(); clock = setInterval(() => $('elapsed').textContent = ` ${Math.floor((Date.now() - startedAt) / 1000)} s`, 1000);
  setStatus('Separando… puede tardar varios minutos según la duración y tu equipo.', 'working');
};
$('cancel').onclick = () => window.stemLocal.cancel();
window.stemLocal.onLog(value => {
  const kind = /error|exception|traceback|failed/i.test(value) ? 'log-error' : /warning|warn/i.test(value) ? 'log-warn' : /separating|processing|progress|model/i.test(value) ? 'log-info' : 'log-ok';
  const line = document.createElement('span'); line.className = kind;
  value.split(/(\b\d{1,3}%\b|\b\d+\/\d+\b)/).forEach(part => {
    const token = document.createElement('span'); token.textContent = part;
    if (/^\d{1,3}%$|^\d+\/\d+$/.test(part)) token.className = 'log-progress';
    line.append(token);
  });
  $('log').append(line); $('log').scrollTop = $('log').scrollHeight;
});
window.stemLocal.onDone(async result => {
  clearInterval(clock);
  $('start').hidden = false; $('cancel').hidden = true;
  $('technical-state').textContent = result.ok ? '· completado' : '· revisa el registro';
  setStatus(result.message, result.ok ? 'success' : 'error');
  if (result.ok && confirm('La separación ha terminado. ¿Quieres abrir la carpeta de resultados?')) await window.stemLocal.openFolder(outputDir);
});
const profileNotes = { fast: 'Menos cálculos para terminar antes.', balanced: '4 stems con buena relación entre calidad y tiempo.', electronic: 'Más precisión para kick, subgrave y sintetizadores.' };
$('profile').onchange = () => { $('profile-note').textContent = profileNotes[$('profile').value]; };
window.stemLocal.engineInfo().then(info => { device = info.device; $('device-label').textContent = device === 'cuda' ? 'GPU detectada · máxima velocidad' : 'CPU detectada · usa Rápido para ahorrar tiempo'; });
