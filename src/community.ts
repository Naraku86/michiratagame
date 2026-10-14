type Player = { id: string; name: string; best: number; rank: number; active?: boolean };
type Snapshot = { active: number; me: Player; players: Player[] };

export function startCommunity(header: HTMLElement, getPoints: () => number) {
  const menu = document.createElement('details');
  menu.className = 'community';
  const summary = document.createElement('summary');
  summary.textContent = '👥 Conectando…';
  summary.className = 'community__toggle';
  const content = document.createElement('div');
  content.className = 'community__content';
  const title = document.createElement('h2');
  title.textContent = 'Tablero de Michiratas';
  const note = document.createElement('p');
  note.textContent = 'Activos en el último minuto · récord de saldo';
  const form = document.createElement('form');
  const label = document.createElement('label');
  label.textContent = 'Tu nombre público';
  const input = document.createElement('input');
  input.name = 'playerName'; input.maxLength = 24; input.required = true;
  input.setAttribute('autocomplete', 'nickname'); input.placeholder = 'Pon tu nombre';
  label.append(input);
  const button = document.createElement('button');
  button.type = 'submit'; button.textContent = 'Guardar nombre';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const personal = document.createElement('p');
  const table = document.createElement('table');
  const caption = document.createElement('caption');
  caption.textContent = 'Los 50 mejores récords';
  const head = document.createElement('thead');
  const heading = document.createElement('tr');
  for (const text of ['#', 'Jugador', 'Récord']) {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; heading.append(cell);
  }
  head.append(heading);
  const rows = document.createElement('tbody');
  table.append(caption, head, rows);
  form.append(label, button);
  content.append(title, note, form, status, personal, table);
  menu.append(summary, content);
  header.append(menu);
  let busy = false;
  let initialized = false;
  const numbers = new Intl.NumberFormat('es-MX');
  async function sync(name?: string) {
    if (busy || (document.hidden && name === undefined)) return;
    busy = true;
    if (name !== undefined) button.disabled = true;
    try {
      const response = await fetch('/api/presence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: getPoints(), ...(name === undefined ? {} : { name }) }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudo conectar.');
      const snapshot = data as Snapshot;
      summary.textContent = `👥 ${snapshot.active} ${snapshot.active === 1 ? 'activo' : 'activos'}`;
      personal.textContent = `Tu puesto: #${snapshot.me.rank} · récord ${numbers.format(snapshot.me.best)} pts`;
      if (!initialized || name !== undefined) { input.value = snapshot.me.name; initialized = true; }
      rows.replaceChildren();
      for (const player of snapshot.players) {
        const row = document.createElement('tr');
        if (player.id === snapshot.me.id) row.className = 'community__me';
        for (const text of [String(player.rank), `${player.active ? '● ' : ''}${player.name}`, numbers.format(player.best)]) {
          const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
        }
        rows.append(row);
      }
      status.textContent = name === undefined ? '' : 'Nombre guardado.';
    } catch (error) {
      summary.textContent = '👥 Sin conexión';
      status.textContent = error instanceof Error ? error.message : 'No se pudo conectar. El juego sigue funcionando.';
    } finally { busy = false; button.disabled = false; }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) { status.textContent = 'Conectando; vuelve a guardar en unos segundos.'; return; }
    void sync(input.value.trim());
  });
  void sync();
  setInterval(() => void sync(), 20_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
  menu.addEventListener('toggle', () => { if (menu.open) void sync(); });
}
