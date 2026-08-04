(() => {
  'use strict';

  const INCIDENT_STORAGE_KEY = 'wtfd-incident-command-v2';
  const query = new URLSearchParams(window.location.search);
  const incidentKey = query.get('incident') || 'manual';
  const SKETCH_STORAGE_KEY = `wtfd-command-sketch:${incidentKey}`;
  const canvas = document.getElementById('sketchCanvas');
  const wrap = document.getElementById('canvasWrap');
  const context = canvas.getContext('2d');
  const state = {
    tool: 'pencil',
    color: '#f7f9fc',
    width: 5,
    commands: [],
    redo: [],
    active: null,
    resizeTimer: null
  };

  function currentIncident() {
    try {
      const incident = JSON.parse(localStorage.getItem(INCIDENT_STORAGE_KEY) || 'null');
      return incident?.key === incidentKey ? incident : null;
    } catch (_) { return null; }
  }

  function setIncidentHeading() {
    const incident = currentIncident();
    document.getElementById('incidentSummary').textContent = incident
      ? `${incident.description || 'Incident'} • ${[incident.address, incident.unit, incident.city].filter(Boolean).join(' ')} • ${incident.cadCode || incident.key}`
      : `Incident ${incidentKey}`;
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SKETCH_STORAGE_KEY) || 'null');
      if (Array.isArray(saved?.commands)) state.commands = saved.commands;
    } catch (_) {}
  }

  function save() {
    localStorage.setItem(SKETCH_STORAGE_KEY, JSON.stringify({ incidentKey, updatedAt: new Date().toISOString(), commands: state.commands }));
    const status = document.getElementById('saveStatus');
    status.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  function normalizedPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  }

  function pixel(point) {
    return { x: point.x * canvas.clientWidth, y: point.y * canvas.clientHeight };
  }

  function prepareContext(command) {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = command.tool === 'eraser' ? '#0b1420' : command.color;
    context.fillStyle = command.color;
    context.lineWidth = command.tool === 'eraser' ? command.width * 3 : command.width;
  }

  function drawCommand(command) {
    prepareContext(command);
    if (command.tool === 'pencil' || command.tool === 'eraser') {
      if (command.points.length < 2) return;
      context.beginPath();
      command.points.forEach((point, index) => {
        const next = pixel(point);
        if (!index) context.moveTo(next.x, next.y);
        else context.lineTo(next.x, next.y);
      });
      context.stroke();
      return;
    }
    if (command.tool === 'line') {
      const start = pixel(command.start); const end = pixel(command.end);
      context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
      return;
    }
    if (command.tool === 'rectangle') {
      const start = pixel(command.start); const end = pixel(command.end);
      context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      return;
    }
    if (command.tool === 'text') {
      const at = pixel(command.at);
      context.font = `800 ${Math.max(16, command.width * 4)}px Inter, sans-serif`;
      context.fillText(command.text, at.x, at.y);
    }
  }

  function drawGrid() {
    const width = canvas.clientWidth; const height = canvas.clientHeight;
    context.fillStyle = '#0b1420'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#17263a'; context.lineWidth = 1;
    const spacing = 32;
    for (let x = 0; x <= width; x += spacing) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = 0; y <= height; y += spacing) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  }

  function redraw() {
    const scale = window.devicePixelRatio || 1;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    drawGrid();
    state.commands.forEach(drawCommand);
    if (state.active) drawCommand(state.active);
  }

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    redraw();
  }

  function pointerDown(event) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = normalizedPoint(event);
    if (state.tool === 'text') {
      const text = window.prompt('Label text');
      if (text?.trim()) commit({ tool: 'text', color: state.color, width: state.width, at: point, text: text.trim() });
      return;
    }
    state.active = state.tool === 'pencil' || state.tool === 'eraser'
      ? { tool: state.tool, color: state.color, width: state.width, points: [point] }
      : { tool: state.tool, color: state.color, width: state.width, start: point, end: point };
  }

  function pointerMove(event) {
    if (!state.active) return;
    event.preventDefault();
    const point = normalizedPoint(event);
    if (state.active.points) state.active.points.push(point);
    else state.active.end = point;
    redraw();
  }

  function pointerUp(event) {
    if (!state.active) return;
    event.preventDefault();
    const command = state.active;
    state.active = null;
    commit(command);
  }

  function commit(command) {
    state.commands.push(command);
    state.redo = [];
    save();
    redraw();
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    document.getElementById('undoSketch').disabled = !state.commands.length;
    document.getElementById('redoSketch').disabled = !state.redo.length;
  }

  function addTemplate(type) {
    const margin = type === 'commercial' ? .15 : .25;
    const color = state.color;
    commit({ tool: 'rectangle', color, width: 6, start: { x: margin, y: .2 }, end: { x: 1 - margin, y: .78 } });
    [
      ['SIDE A', { x: .47, y: .17 }], ['SIDE B', { x: 1 - margin + .02, y: .5 }],
      ['SIDE C', { x: .47, y: .84 }], ['SIDE D', { x: margin - .09, y: .5 }]
    ].forEach(([text, at]) => commit({ tool: 'text', color, width: 4, at, text }));
  }

  function exportPng() {
    redraw();
    const link = document.createElement('a');
    link.download = `WTFD-Tactical-Sketch-${incidentKey.replace(/[^a-z0-9-]/gi, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
    state.tool = button.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach(item => item.classList.toggle('active', item === button));
  }));
  document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
    state.color = button.dataset.color;
    document.querySelectorAll('[data-color]').forEach(item => item.classList.toggle('active', item === button));
  }));
  document.getElementById('lineWidth').addEventListener('input', event => { state.width = Number(event.target.value); });
  document.getElementById('undoSketch').addEventListener('click', () => { if (state.commands.length) state.redo.push(state.commands.pop()); save(); redraw(); updateHistoryButtons(); });
  document.getElementById('redoSketch').addEventListener('click', () => { if (state.redo.length) state.commands.push(state.redo.pop()); save(); redraw(); updateHistoryButtons(); });
  document.getElementById('clearSketch').addEventListener('click', () => { if (window.confirm('Clear the entire tactical sketch?')) { state.commands = []; state.redo = []; save(); redraw(); updateHistoryButtons(); } });
  document.getElementById('residentialTemplate').addEventListener('click', () => addTemplate('residential'));
  document.getElementById('commercialTemplate').addEventListener('click', () => addTemplate('commercial'));
  document.getElementById('exportSketch').addEventListener('click', exportPng);
  document.getElementById('closeSketch').addEventListener('click', () => { window.location.href = '/command.html'; });
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  new ResizeObserver(() => { clearTimeout(state.resizeTimer); state.resizeTimer = setTimeout(resize, 60); }).observe(wrap);

  setIncidentHeading();
  load();
  resize();
  updateHistoryButtons();
})();
