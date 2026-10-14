import { setupAuth, type AuthClient } from './auth.ts';

/** Optional accounts: game progress stays on this device, independent of login. */
export function mountAccount(container: HTMLElement, changed: () => void): AuthClient | null {
  let setup;
  try { setup = setupAuth(import.meta.env, { storage: localStorage, origin: location.origin }); }
  catch { return null; }
  if (setup.status !== 'ready') return null;
  const client = setup.client;
  const panel = document.createElement('details');
  panel.className = 'account';
  const summary = document.createElement('summary'); summary.textContent = 'Cuenta';
  const note = document.createElement('p'); note.textContent = 'Tu cuenta identifica tu jugador. En modo validado, la partida se guarda en el servidor; el demo local conserva su guardado aparte.';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const identity = document.createElement('p');
  const controls = document.createElement('div'); controls.className = 'account__controls';
  const form = document.createElement('form'); form.className = 'account__form';
  const emailLabel = document.createElement('label'); emailLabel.textContent = 'Correo';
  const email = document.createElement('input'); email.type = 'email'; email.required = true; email.autocomplete = 'email'; emailLabel.append(email);
  const passwordLabel = document.createElement('label'); passwordLabel.textContent = 'Contraseña';
  const password = document.createElement('input'); password.type = 'password'; password.minLength = 8; password.maxLength = 72; password.required = true; password.autocomplete = 'current-password'; passwordLabel.append(password);
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Entrar';
  form.append(emailLabel, passwordLabel, submit);
  let recovery = false;
  let busy = false;
  const buttons: HTMLButtonElement[] = [submit];
  function render() {
    const session = client.session();
    identity.textContent = session ? `Sesión: ${session.user.email ?? 'cuenta conectada'}` : 'Sin sesión';
    form.hidden = !!session && !recovery;
    controls.hidden = !!session;
    logout.hidden = !session;
    emailLabel.hidden = recovery;
    email.required = !recovery;
    submit.textContent = recovery ? 'Guardar nueva contraseña' : 'Entrar';
    password.autocomplete = recovery ? 'new-password' : 'current-password';
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true; buttons.forEach(button => { button.disabled = true; }); status.textContent = 'Procesando…';
    try { await action(); render(); changed(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'No se pudo completar el acceso. Tu partida sigue guardada.'; }
    finally { password.value = ''; busy = false; buttons.forEach(button => { button.disabled = false; }); }
  }
  function button(text: string, action: () => Promise<void>, parent: HTMLElement = controls) {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = text;
    element.addEventListener('click', () => void run(action)); buttons.push(element); parent.append(element); return element;
  }
  for (const provider of ['google', 'facebook'] as const) button(`Entrar con ${provider === 'google' ? 'Google' : 'Facebook'}`, async () => { location.assign(await client.oauthUrl(provider)); });
  button('Crear cuenta', async () => {
    if (!form.reportValidity()) { status.textContent = 'Completa correo y contraseña.'; return; }
    const session = await client.signUp(email.value, password.value);
    status.textContent = session ? 'Cuenta creada.' : 'Si corresponde, recibirás un enlace para confirmar el correo. Ábrelo en este navegador.';
  });
  button('Reenviar confirmación', async () => { await client.resendConfirmation(email.value); status.textContent = 'Si corresponde, recibirás un enlace de confirmación. Ábrelo en este navegador.'; });
  button('Recuperar contraseña', async () => { await client.requestPasswordReset(email.value); status.textContent = 'Si existe una cuenta con ese correo, recibirás un enlace. Ábrelo en este navegador para cambiar la contraseña.'; });
  const logout = button('Cerrar sesión', async () => { await client.signOut(); recovery = false; status.textContent = 'Sesión cerrada. Tu partida permanece en este dispositivo.'; }, panel);
  form.addEventListener('submit', event => {
    event.preventDefault();
    void run(async () => {
      if (recovery) { await client.updatePassword(password.value); recovery = false; status.textContent = 'Contraseña actualizada.'; }
      else { await client.signIn(email.value, password.value); status.textContent = 'Sesión iniciada.'; }
    });
  });
  panel.append(summary, note, identity, form, controls, logout, status); container.append(panel); render();
  void run(async () => {
    const back = await client.completeRedirect(location.href);
    if (back.handled) {
      history.replaceState(null, '', back.cleanUrl); panel.open = true;
      if ('error' in back) throw back.error;
      recovery = back.kind === 'recovery';
      status.textContent = recovery ? 'Elige tu nueva contraseña.' : 'Sesión iniciada.';
      render(); if (recovery) password.focus();
    } else status.textContent = '';
  });
  return client;
}
