(() => {
  const header = document.querySelector('header');
  const picker = document.createElement('div');
  picker.id = 'language';
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Idioma / Language');
  for (const [code, name] of [['es', 'Español'], ['en', 'English']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = code.toUpperCase();
    button.lang = code;
    button.title = name;
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-pressed', String(document.documentElement.lang === code));
    button.addEventListener('click', () => setLanguage(code));
    picker.append(button);
  }
  header.append(picker);
  const labels = [
    ['header p', 'Split your music without uploading it to a server.'],
    ['header .local', '● Local processing'],
    ['.workspace > .section-title h2', 'Your track'],
    ['.workspace > .section-title p', 'One track at a time for maximum stability.'],
    ['#pick-tracks', 'Choose track'],
    ['#drop-zone > span', 'or drag it here'],
    ['.config-row > div:first-child .section-title h2', 'Separation'],
    ['.select-pair label:first-child', 'Profile'],
    ['.select-pair label:nth-child(2)', 'Extract'],
    ['#profile option[value="fast"]', 'Fast'],
    ['#profile option[value="balanced"]', 'Balanced'],
    ['#profile option[value="electronic"]', 'Electronic'],
    ['#stem-mode option[value="vocals"]', 'Vocals'],
    ['#stem-mode option[value="drums"]', 'Drums'],
    ['#stem-mode option[value="bass"]', 'Bass'],
    ['.config-row .hint:last-child', 'Synthesizers are saved in '],
    ['.destination h2', 'Output'],
    ['.destination .section-title p', 'Creates '],
    ['.destination .section-title em', 'TrackName_stems'],
    ['#pick-output', 'Choose folder'],
    ['#start', 'Separate stems'],
    ['#cancel', 'Cancel'],
    ['#technical summary', 'Technical details ']
  ];
  const translations = labels.flatMap(([selector, english]) => {
    const element = document.querySelector(selector);
    const text = element && [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.data.trim());
    return text ? [[text, text.data, english]] : [];
  });

  const messages = new Map([
    ['Selecciona un tema para comenzar.', 'Choose a track to get started.'],
    ['Detectando dispositivo…', 'Detecting device…'],
    ['GPU detectada · máxima velocidad', 'GPU detected · maximum speed'],
    ['CPU detectada · usa Rápido para ahorrar tiempo', 'CPU detected · use Fast to save time'],
    ['Menos cálculos para terminar antes.', 'Fewer calculations for faster separation.'],
    ['4 stems con buena relación entre calidad y tiempo.', 'Four stems with a balance of quality and speed.'],
    ['Más precisión para kick, subgrave y sintetizadores.', 'Higher precision for kicks, sub-bass and synthesizers.'],
    ['Ninguna carpeta seleccionada.', 'No folder selected.'],
    ['Elige un tema y una carpeta.', 'Choose a track and a folder.'],
    ['Preparando información…', 'Preparing track information…'],
    ['Track listo para separar', 'Track ready to separate'],
    ['1 canción lista.', '1 track ready.'],
    ['Suelta archivos de audio compatibles.', 'Drop compatible audio files.'],
    ['Separando… puede tardar varios minutos según la duración y tu equipo.', 'Separating… this may take several minutes depending on the track length and your hardware.'],
    ['· en espera', '· idle'],
    ['En espera.', 'Waiting.'],
    ['· en directo', '· live'],
    ['· completado', '· complete'],
    ['· revisa el registro', '· check the log']
  ]);
  const dynamicSelector = '#device-label, #profile-note, #status, #technical-state, #track-list .empty, #track-list small';
  const messageSources = new WeakMap();
  const observer = new MutationObserver(updateMessages);

  function updateMessages() {
    observer.disconnect();
    for (const element of document.querySelectorAll(dynamicSelector + ', #output-path, #log')) {
      const current = element.textContent;
      const previous = messageSources.get(element);
      const source = previous?.displayed === current ? previous.source : current;
      const english = messages.get(source) ?? source.replace(/^(\d+ s) · listo$/, '$1 · ready');
      const displayed = document.documentElement.lang === 'en' ? english : source;
      if (displayed !== current) element.textContent = displayed;
      messageSources.set(element, { source, displayed });
    }
    for (const button of document.querySelectorAll('#track-list .remove')) {
      button.title = document.documentElement.lang === 'en' ? 'Remove track' : 'Quitar tema';
    }
    for (const cover of document.querySelectorAll('#track-list .cover')) {
      cover.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Artwork' : 'Carátula');
    }
    for (const id of ['device-label', 'profile-note', 'status', 'technical-state', 'track-list', 'output-path', 'log']) {
      observer.observe(document.getElementById(id), { childList: true, characterData: true, subtree: true });
    }
  }

  function setLanguage(code) {
    document.documentElement.lang = code;
    for (const button of picker.children) {
      button.setAttribute('aria-pressed', String(button.lang === code));
    }
    for (const [text, spanish, english] of translations) {
      text.data = document.documentElement.lang === 'en' ? english : spanish;
    }
    updateMessages();
  }
  updateMessages();
})();
