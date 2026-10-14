import { freshPrestige, availableBigotes, pendingBigotes, canPrestige, SUPER, SUPER_IDS, superCost, clickMultiplier, productionMultiplier, prestigeCost, type PrestigeState, type SuperId } from './prestige.ts';
import { dismissOnSwipe } from './swipe.ts';
import './style.css';
import { milestoneMultiplier, pointsPerClick, production, SKINS, NEW_SKIN_POWERS } from './game.ts';
import type { GameState, Upgrade, Skin, TapEffect } from './game.ts';

export interface UIHandlers {
  soundEnabled: boolean;
  toggleSound: () => boolean;
  click: () => void;
  buy: (upgrade: Upgrade) => void;
  skin: (skin: Skin) => void;
  reset: () => void;
  prestige: () => void;
  super: (id: SuperId) => void;
}

export interface UI {
  render: (state: GameState, prestige?: PrestigeState) => void;
  feedback: (amount: number, effect: TapEffect, chain: number) => void;
  status: (message: string) => void;
  fatigue: (factor: number, penalty?: boolean, steady?: boolean) => void;
  celebrate: (message: string, animation?: 'face' | 'jump') => void;
}

const MAX_LEVEL = 100;
const MAX_FLOATERS = 6;
// Tope de nodos vivos en la capa de efectos (flotantes + partículas).
const MAX_FX = 24;
const MAX_VISIBLE_WORKERS = 12;
const COMBO_TIMEOUT_MS = 1500;
const BADGE_TIMEOUT_MS = 900;

// Toques seguidos que pide cada Michirata para su bono; el puntaje lo decide game.ts.
const CHAIN_TARGETS: Partial<Record<string, number>> = { football: 8, robot: 10, godin: 12, jester: 5, ...Object.fromEntries(Object.entries(NEW_SKIN_POWERS).map(([id, power]) => [id, power.chain])) };

const EFFECTS: Record<TapEffect, { label: string; frames: Keyframe[]; duration: number }> = {
  none: {
    label: '',
    frames: [{ transform: 'scale(1)' }, { transform: 'scale(0.95)', offset: 0.35 }, { transform: 'scale(1.02)', offset: 0.7 }, { transform: 'scale(1)' }],
    duration: 180,
  },
  goal: {
    label: '⚽ ¡GOOOL!',
    frames: [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-4deg) scale(1.04)', offset: 0.3 }, { transform: 'rotate(3deg) scale(1.02)', offset: 0.65 }, { transform: 'rotate(0) scale(1)' }],
    duration: 520,
  },
  sparks: {
    label: '⚡ ¡Chispazo!',
    frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.05)', offset: 0.4 }, { transform: 'scale(1)' }],
    duration: 420,
  },
  coffee: {
    label: '☕ ¡Cafecito de oficina!',
    frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(5px)', offset: 0.4 }, { transform: 'translateY(-2px)', offset: 0.75 }, { transform: 'translateY(0)' }],
    duration: 560,
  },
  chaos: {
    label: '🃏 ¡Puro caos!',
    frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(5deg)', offset: 0.3 }, { transform: 'rotate(-4deg)', offset: 0.65 }, { transform: 'rotate(0)' }],
    duration: 560,
  },
  coins: {
    label: '🪙 ¡Lluvia de monedas!',
    frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.45 }, { transform: 'scale(1)' }],
    duration: 480,
  },
};

const CONFETTI = ['#ff5fa2', '#ffd23f', '#2fd6c3', '#b06ac0', '#ff8a4c'];

const numberFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

// Los puntos pueden ser fraccionarios; se muestran hacia abajo para no
// aparentar que alcanza para una compra que todavía no se puede hacer.
function formatNumber(value: number): string {
  return numberFormat.format(Number.isFinite(value) ? Math.floor(value) : 0);
}

const fractionalFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
function formatReward(value: number): string {
  return value > 0 && value < 0.01 ? '<0.01' : value < 1 ? fractionalFormat.format(value) : formatNumber(value);
}

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface UpgradeCard {
  level: HTMLElement;
  effect: HTMLElement;
  warning: HTMLElement;
  price: HTMLElement;
  button: HTMLButtonElement;
}

const UPGRADES: { id: Upgrade; name: string; action: string }[] = [
  { id: 'click', name: 'Toque más fuerte', action: '💪 Mejorar clic' },
  { id: 'auto', name: 'Contratar trabajadora', action: '🐀 Trabajadora' },
];

function skinImage(id: string): string {
  return SKINS.find(skin => skin.id === id)?.image ?? `/assets/michirata-${id}.jpg`;
}

export function createUI(root: HTMLElement, handlers: UIHandlers): UI {
  const app = el('main', 'game');

  // Encabezado
  const header = el('header', 'game__header');
  header.append(
    el('h1', 'game__title', 'Michiratagame'),
  );
  const soundButton = el('button', 'game__reset game__toggle');
  soundButton.type = 'button';
  soundButton.setAttribute('aria-label', 'Sonido de Michirata');
  function updateSound(enabled: boolean) {
    soundButton.textContent = enabled ? '🔊 Sonido: sí' : '🔇 Sonido: no';
    soundButton.setAttribute('aria-pressed', String(enabled));
  }
  updateSound(handlers.soundEnabled);
  soundButton.addEventListener('click', () => updateSound(handlers.toggleSound()));

  // Solo de esta sesión: apaga partículas y animaciones, nunca las recompensas.
  let effectsOn = true;
  let heroAnimation: Animation | null = null;
  const effectsButton = el('button', 'game__reset game__toggle');
  effectsButton.type = 'button';
  effectsButton.setAttribute('aria-label', 'Animaciones y efectos visuales');
  effectsButton.title = 'Apaga partículas, saltos y stickers. Los puntos y premios no cambian.';
  function updateEffects() {
    effectsButton.textContent = effectsOn ? '✨ Animaciones: sí' : '💤 Animaciones: no';
    effectsButton.setAttribute('aria-pressed', String(effectsOn));
    app.dataset.motion = effectsOn ? 'on' : 'off';
  }
  updateEffects();
  effectsButton.addEventListener('click', () => {
    effectsOn = !effectsOn;
    updateEffects();
    updateHeroMotion();
    if (!effectsOn) {
      heroAnimation?.cancel();
      heroAnimation = null;
      heroFx.replaceChildren();
      hideReactions();
    }
  });
  const toggles = el('div', 'game__toggles');
  toggles.append(soundButton, effectsButton);
  const settings = el('details', 'game__settings');
  dismissOnSwipe(settings);
  settings.append(el('summary', 'game__settings-title', 'Ajustes'), toggles);
  header.append(settings);

  // Puntos y ritmo: siempre a la vista, también al cambiar de sección.
  const score = el('section', 'score');
  score.setAttribute('aria-label', 'Puntos y ritmo');
  const points = el('p', 'score__points', '0');
  // Única región viva de juego: clics, compras y cambios de Michirata.
  const announcement = el('span', 'sr-only');
  announcement.setAttribute('role', 'status');
  const scoreMain = el('div', 'score__main');
  scoreMain.append(points, el('p', 'score__label', 'puntos'));
  const stats = el('dl', 'stats');
  const perClick = el('dd', 'stats__value', '0');
  let baseClickReward = 1;
  let clickFactor = 1;
  let productionBeforePenalty = 0;
  let penaltyOn = false;
  const perSecond = el('dd', 'stats__value', '0');
  const perClickItem = el('div', 'stats__item stats__item--click');
  perClickItem.append(el('dt', 'stats__label', 'Por clic'), perClick);
  const perSecondItem = el('div', 'stats__item stats__item--auto');
  perSecondItem.append(el('dt', 'stats__label', 'Por segundo'), perSecond);
  stats.append(perClickItem, perSecondItem);
  score.append(scoreMain, stats, announcement);

  // Michirata
  const hero = el('div', 'hero');
  const heroButton = el('button', 'hero__button');
  heroButton.type = 'button';
  heroButton.setAttribute('aria-label', 'Tocar a Michirata para ganar puntos');
  const heroImage = el('img', 'hero__image');
  heroImage.src = '/assets/michirata-original.jpg';
  heroImage.alt = '';
  heroImage.width = 1536;
  heroImage.height = 1536;
  heroImage.draggable = false;
  heroImage.decoding = 'async';
  const heroStill = el('canvas', 'hero__image hero__still');
  heroStill.setAttribute('aria-hidden', 'true');
  heroStill.hidden = true;
  heroButton.append(heroImage, heroStill);
  let frozenSource = '';
  const animatedSkins = new Set<Skin>(['sirena', 'venadito', 'tecladista', 'magica']);
  function updateHeroMotion() {
    updatePreviewMotion();
    const freeze = animatedSkins.has(currentSkin ?? 'original') && (!effectsOn || prefersReducedMotion());
    if (!freeze) { heroStill.hidden = true; heroImage.hidden = false; frozenSource = ''; return; }
    if (!heroImage.complete || !heroImage.naturalWidth) return;
    if (frozenSource !== heroImage.src) {
      heroStill.width = heroImage.naturalWidth; heroStill.height = heroImage.naturalHeight;
      heroStill.getContext('2d')?.drawImage(heroImage, 0, 0);
      frozenSource = heroImage.src;
    }
    heroStill.hidden = false; heroImage.hidden = true;
  }
  heroImage.addEventListener('load', updateHeroMotion);
  const heroFx = el('div', 'hero__fx');
  heroFx.setAttribute('aria-hidden', 'true');
  // Aviso fijo para movimiento reducido o efectos apagados.
  const heroBadge = el('p', 'hero__badge');
  heroBadge.setAttribute('aria-hidden', 'true');
  heroBadge.hidden = true;
  hero.append(heroButton, heroFx, heroBadge);
  // Aviso de compra con su sticker: flota sobre cualquier sección.
  const celebration = el('img', 'hero__reaction');
  celebration.alt = '';
  celebration.setAttribute('aria-hidden', 'true');
  celebration.width = 341;
  celebration.height = 341;
  celebration.hidden = true;
  celebration.draggable = false;
  const purchaseReward = el('div', 'purchase__reward');
  const rewardText = el('p', 'purchase__text');
  const dismissReward = el('button', 'purchase__dismiss', '×');
  dismissReward.type = 'button';
  dismissReward.setAttribute('aria-label', 'Cerrar animación de recompensa');
  purchaseReward.append(celebration, rewardText, dismissReward);
  purchaseReward.hidden = true;
  let rewardTimer: number | undefined;
  let reactionTimer: number | undefined;
  function hideReactions() {
    window.clearTimeout(reactionTimer);
    celebration.hidden = true;
    celebration.removeAttribute('src');
  }
  let swipe: { id: number; x: number; y: number } | null = null;
  function closeReward() {
    window.clearTimeout(rewardTimer);
    hideReactions();
    purchaseReward.hidden = true;
    swipe = null;
    purchaseReward.style.transform = '';
  }
  dismissReward.addEventListener('click', closeReward);
  purchaseReward.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.pointerType === 'mouse' || event.target === dismissReward) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    purchaseReward.setPointerCapture(event.pointerId);
  });
  purchaseReward.addEventListener('pointermove', (event) => {
    if (swipe?.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    if (Math.abs(dx) > Math.abs(event.clientY - swipe.y))
      purchaseReward.style.transform = `translateX(${dx}px)`;
  });
  purchaseReward.addEventListener('pointerup', (event) => {
    if (swipe?.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) closeReward();
    else {
      swipe = null;
      purchaseReward.style.transform = '';
    }
  });
  purchaseReward.addEventListener('lostpointercapture', () => {
    swipe = null;
    purchaseReward.style.transform = '';
  });
  function showCelebration(animation: 'face' | 'jump') {
    hideReactions();
    celebration.src = animation === 'face' ? '/assets/michirata-reaccion.webp' : '/assets/michirata-salto.webp';
    celebration.hidden = false;
    reactionTimer = window.setTimeout(hideReactions, 5000);
  }
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) {
      hideReactions();
      heroAnimation?.cancel();
      heroFx.replaceChildren();
    }
    updateHeroMotion();
  });

  // Posición del último toque, en % del área de la Michirata.
  let fxX = 50;
  let fxY = 22;
  heroButton.addEventListener('click', (event) => {
    const rect = hero.getBoundingClientRect();
    if (event.detail > 0 && rect.width > 0 && rect.height > 0) {
      fxX = Math.min(92, Math.max(8, ((event.clientX - rect.left) / rect.width) * 100));
      fxY = Math.min(90, Math.max(12, ((event.clientY - rect.top) / rect.height) * 100));
    } else {
      // Activación con teclado: no hay coordenadas.
      fxX = 50;
      fxY = 22;
    }
    handlers.click();
  });

  // Evento y racha
  const combo = el('div', 'combo');
  const comboEvent = el('p', 'combo__event');
  const comboChain = el('div', 'combo__chain');
  const comboCount = el('span', 'combo__count');
  const comboTrack = el('span', 'combo__track');
  const comboFill = el('span', 'combo__fill');
  comboTrack.setAttribute('aria-hidden', 'true');
  comboTrack.append(comboFill);
  comboChain.append(comboCount, comboTrack);
  combo.append(comboEvent, comboChain);
  const fatigueNotice = el('p', 'fatigue');
  fatigueNotice.hidden = true;
  fatigueNotice.title = 'Ritmo 1–8/s: bono +10 %. Más de 30/s durante 10 segundos: saldo y tablero −1 %/s, producción pausada. Descansa para recuperar.';

  // Cuadrilla de trabajadoras
  const crew = el('section', 'crew');
  crew.setAttribute('aria-label', 'Trabajadoras contratadas');
  const crewSprites = el('div', 'crew__sprites');
  crewSprites.setAttribute('aria-hidden', 'true');
  const crewCount = el('p', 'crew__count');
  const crewBadge = el('p', 'crew__badge');
  crewBadge.hidden = true;
  const crewInfo = el('div', 'crew__info');
  crewInfo.append(crewCount, crewBadge);
  crew.append(crewSprites, crewInfo);

  const playPanel = el('section', 'panel panel--play');
  playPanel.id = 'panel-play';
  playPanel.setAttribute('aria-label', 'Jugar');
  playPanel.append(hero, combo, fatigueNotice, crew);

  // Mejoras y metas permanentes
  const shop = el('section', 'panel panel--shop shop');
  shop.id = 'panel-shop';
  shop.setAttribute('aria-labelledby', 'shop-title');
  const shopTitle = el('h2', 'shop__title', 'Mejoras');
  shopTitle.id = 'shop-title';
  shopTitle.tabIndex = -1;
  const shopList = el('div', 'shop__list');
  const cards = {} as Record<Upgrade, UpgradeCard>;
  for (const upgrade of UPGRADES) {
    const card = el('article', `upgrade upgrade--${upgrade.id}`);
    const head = el('div', 'upgrade__head');
    const level = el('p', 'upgrade__level', '');
    head.append(el('h3', 'upgrade__name', upgrade.name), level);
    const effect = el('p', 'upgrade__effect');
    const warning = el('p', 'upgrade__warning', 'Vista previa con tus ahorros actuales: con Magnate, gastar puede bajar su bono.');
    warning.hidden = true;
    const button = el('button', 'upgrade__buy');
    button.type = 'button';
    const price = el('span', 'upgrade__price', '');
    button.append(el('span', 'upgrade__action', upgrade.action), price);
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') handlers.buy(upgrade.id);
    });
    const info = el('details', 'upgrade__info');
    info.append(el('summary', 'upgrade__summary', 'ⓘ'), head, effect, warning);
    info.querySelector('summary')!.setAttribute('aria-label', `Ver mejora: ${upgrade.name}`);
    card.append(button, info);
    shopList.append(card);
    cards[upgrade.id] = { level, effect, warning, price, button };
  }
  shopTitle.classList.add('sr-only');
  shop.append(shopTitle, shopList);

  const skins = el('details', 'skins');
  dismissOnSwipe(skins);
  const skinsSummary = el('summary', 'skins__toggle', 'Cambiar Michirata');
  skins.id = 'panel-collection';
  skins.setAttribute('aria-labelledby', 'skins-title');
  const skinsTitle = el('h2', 'shop__title', 'Colección de Michiratas');
  skinsTitle.id = 'skins-title';
  skinsTitle.tabIndex = -1;
  const skinsList = el('div', 'skins__list');
  const skinButtons = new Map<Skin, HTMLButtonElement>();
  const skinStates = new Map<Skin, HTMLElement>();
  for (const skin of SKINS) {
    const card = el('article', `skin skin--${skin.id}`);
    const image = el('img', 'skin__image');
    image.dataset.src = skin.image;
    image.loading = 'lazy';
    if (animatedSkins.has(skin.id)) image.addEventListener('load', updatePreviewMotion);
    image.alt = '';
    image.width = 96;
    image.height = 96;
    image.decoding = 'async';
    const button = el('button', 'skin__button');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') {
        handlers.skin(skin.id);
        skins.open = false;
        skinsSummary.focus({ preventScroll: true });
      }
    });
    const state = el('p', 'skin__state');
    const power = el('details', 'skin__power');
    const summary = el('summary', 'skin__summary', 'Ver poder');
    summary.setAttribute('aria-label', `Ver poder de ${skin.name}`);
    power.append(summary, el('p', 'skin__description', skin.power));
    card.append(image, el('h3', 'skin__name', skin.name), state, power, button);
    skinsList.append(card);
    skinButtons.set(skin.id, button);
    skinStates.set(skin.id, state);
  }
  skinsTitle.classList.add('sr-only');
  skins.append(skinsSummary, skinsTitle, skinsList);
  function updatePreviewMotion() {
    for (const image of Array.from(skinsList.querySelectorAll<HTMLImageElement>('img'))) {
      const src = image.dataset.src ?? '';
      if (!['sirena', 'venadito', 'tecladista', 'magica'].some(id => src.endsWith(`michirata-${id}.webp`)) || !image.getAttribute('src')) continue;
      if (effectsOn && !prefersReducedMotion()) {
        if (image.src.startsWith('data:')) image.src = src;
      } else if (!image.src.startsWith('data:') && image.complete && image.naturalWidth) {
        const still = document.createElement('canvas');
        still.width = image.naturalWidth; still.height = image.naturalHeight;
        still.getContext('2d')?.drawImage(image, 0, 0);
        image.src = still.toDataURL();
      }
    }
  }
  skins.addEventListener('toggle', () => {
    for (const image of Array.from(skinsList.querySelectorAll<HTMLImageElement>('img'))) {
      if (skins.open) image.src = image.dataset.src!;
      else image.removeAttribute('src');
    }
  });

  // Aviso de guardado: fuera de las secciones para verse en todas.
  const statusLine = el('p', 'game__status');
  statusLine.setAttribute('role', 'status');
  statusLine.hidden = true;

  // Reinicio: a la mano en todas las secciones, pero secundario.
  const prestigeMenu = el('details', 'prestige');
  const prestigeSummary = el('summary', 'prestige__toggle', 'Renacer y super mejoras');
  const prestigeInfo = el('p', 'game__note');
  const rebirthButton = el('button', 'game__reset', 'Renacer');
  rebirthButton.type = 'button';
  rebirthButton.addEventListener('click', () => handlers.prestige());
  const superButtons = new Map<SuperId, HTMLButtonElement>();
  prestigeMenu.append(prestigeSummary, prestigeInfo, rebirthButton);
  for (const id of SUPER_IDS) {
    const button = el('button', 'game__reset');
    button.type = 'button'; button.title = SUPER[id].text;
    button.addEventListener('click', () => handlers.super(id));
    superButtons.set(id, button); prestigeMenu.append(button);
  }
  settings.append(prestigeMenu);
  const prestigeBadge = el('p', 'score__prestige');
  prestigeBadge.hidden = true; scoreMain.append(prestigeBadge);
  const resetButton = el('button', 'game__reset', 'Borrar partida');
  resetButton.type = 'button';
  resetButton.addEventListener('click', () => handlers.reset());
  settings.append(el('p', 'game__note', 'Guardado en este dispositivo. La producción se pausa al salir.'), resetButton);

  const controls = el('div', 'game__controls');
  controls.append(shop, skins);
  app.append(header, score, playPanel, controls, statusLine, purchaseReward);
  root.replaceChildren(app);

  function renderUpgrade(state: GameState, upgrade: Upgrade, level: number, p: PrestigeState): void {
    const card = cards[upgrade];
    const hire = upgrade === 'auto';
    const maxed = level >= MAX_LEVEL;
    const price = prestigeCost(state, p, upgrade);
    const unit = hire ? 'puntos/s' : 'puntos por clic';
    const current = hire ? production(state) * productionMultiplier(p) : pointsPerClick(state) * clickMultiplier(p);
    setText(card.level, maxed ? (hire ? 'Cuadrilla completa' : 'Nivel máximo') : hire ? `${formatNumber(level)} contratadas` : `Nivel ${formatNumber(level)}`);
    if (maxed) {
      setText(card.effect, `Al máximo: ${formatNumber(current)} ${unit}.`);
    } else {
      // Vista previa: mismo estado con un nivel más, sin gastar puntos.
      const preview: GameState = hire ? { ...state, autoLevel: level + 1 } : { ...state, clickLevel: level + 1 };
      const next = hire ? production(preview) * productionMultiplier(p) : pointsPerClick(preview) * clickMultiplier(p);
      const milestone = milestoneMultiplier(level + 1) > milestoneMultiplier(level);
      setText(card.effect, `${milestone ? '¡Potencia duplicada! ' : ''}${formatNumber(current)} → ${formatNumber(next)} ${unit}`);
    }
    card.warning.hidden = maxed || state.equippedSkin !== 'magnate';
    setText(card.price, maxed ? 'Completa' : `${formatNumber(price)} pts`);
    const disabled = maxed || state.points < price;
    card.button.setAttribute('aria-disabled', String(disabled));
    card.button.setAttribute('aria-label', `${hire ? 'Contratar trabajadora' : 'Comprar Toque más fuerte'}, ${maxed ? 'nivel máximo' : `${formatNumber(price)} pts`}`);
  }

  let currentSkin: Skin | null = null;
  let comboTimer: number | undefined;
  let badgeTimer: number | undefined;

  function showChain(skin: Skin, chain: number, bonus: boolean): void {
    const target = CHAIN_TARGETS[skin];
    comboChain.hidden = target === undefined;
    if (target === undefined) return;
    const progress = bonus ? target : Math.max(0, Math.floor(chain) || 0) % target;
    setText(comboCount, bonus ? '¡Bono!' : `Racha ${progress}/${target}`);
    comboFill.style.width = `${(progress / target) * 100}%`;
  }

  function resetCombo(): void {
    window.clearTimeout(comboTimer);
    const skin = currentSkin ?? 'original';
    combo.classList.remove('combo--bonus');
    setText(comboEvent, '');
    showChain(skin, 0, false);
  }

  // Añade o quita solo la diferencia para no reiniciar a las que ya trabajan.
  function renderCrew(state: GameState): void {
    const hired = state.autoLevel;
    const visible = Math.min(hired, MAX_VISIBLE_WORKERS);
    while (crewSprites.childElementCount > visible) crewSprites.lastElementChild?.remove();
    while (crewSprites.childElementCount < visible) {
      const index = crewSprites.childElementCount;
      const worker = el('img', 'crew__worker');
      worker.src = skinImage(index % 2 === 0 ? 'godin' : 'robot');
      worker.alt = '';
      worker.width = 64;
      worker.height = 64;
      worker.decoding = 'async';
      worker.draggable = false;
      worker.style.animationDelay = `-${(index * 190) % 1300}ms`;
      crewSprites.append(worker);
    }
    crew.classList.toggle('crew--empty', hired === 0);
    setText(crewCount, hired === 0 ? 'Sin trabajadoras todavía' : hired === 1 ? '1 trabajadora contratada' : `${formatNumber(hired)} trabajadoras contratadas`);
    crewBadge.hidden = true;
    crew.hidden = hired === 0;
  }

  let previousClickLevel = 0;
  let previousAutoLevel = 0;
  let previousSkin: Skin = 'original';
  function render(state: GameState, p = freshPrestige()): void {
    const eligible = canPrestige(state, p);
    setText(prestigeInfo, `${availableBigotes(p)} bigotes disponibles · ${p.runs} renacimientos. Conservas skins y super mejoras; saldo y niveles vuelven a cero. ${eligible.ok ? 'Listo para renacer.' : eligible.reason === 'levels' ? 'Necesitas clic y trabajadoras en nivel 40.' : 'Gana más puntos para obtener otro bigote.'}`);
    rebirthButton.disabled = !eligible.ok;
    setText(rebirthButton, `Renacer · +${pendingBigotes(p)} bigotes`);
    for (const id of SUPER_IDS) {
      const level = p.upgrades[id]; const button = superButtons.get(id)!;
      button.disabled = level >= SUPER[id].max || availableBigotes(p) < superCost(level);
      setText(button, `${SUPER[id].name} ${level}/${SUPER[id].max} · ${level >= SUPER[id].max ? 'Completa' : `${superCost(level)} bigotes`}`);
    }
    prestigeBadge.hidden = p.claimed === 0;
    setText(prestigeBadge, `🎖 ${p.claimed} bigotes · tablero +${Math.min(25, p.claimed)} %`);
    app.dataset.rebirth = p.achievements.includes('vuelta-completa') ? 'astral' : p.runs > 0 ? 'gold' : 'none';
    if (state.equippedSkin !== currentSkin) {
      currentSkin = state.equippedSkin;
      app.dataset.skin = currentSkin;
      resetCombo();
      hideReactions();
      setText(skinsSummary, `Cambiar Michirata · ${SKINS.find(skin => skin.id === currentSkin)!.name}`);
    }
    setText(points, formatNumber(state.points));
    baseClickReward = pointsPerClick(state) * clickMultiplier(p);
    setText(perClick, formatReward(baseClickReward * clickFactor));
    productionBeforePenalty = production(state) * productionMultiplier(p);
    setText(perSecond, formatNumber(penaltyOn ? 0 : productionBeforePenalty));
    renderUpgrade(state, 'click', state.clickLevel, p);
    renderUpgrade(state, 'auto', state.autoLevel, p);
    renderCrew(state);
    for (const skin of SKINS) {
      const button = skinButtons.get(skin.id)!;
      const owned = skin.id === 'original' || state.ownedSkins.includes(skin.id);
      const equipped = skin.id === state.equippedSkin;
      setText(button, equipped ? 'En uso' : owned ? 'Usar' : `Comprar · ${formatNumber(skin.price)} pts`);
      button.setAttribute('aria-label', `${skin.name}: ${button.textContent}`);
      button.setAttribute('aria-pressed', String(equipped));
      button.setAttribute('aria-disabled', String(equipped || (!owned && state.points < skin.price)));
      button.closest('article')!.classList.toggle('skin--equipped', equipped);
      setText(skinStates.get(skin.id)!, equipped ? '★ Poder activo' : owned ? 'En tu colección' : 'Por desbloquear');
      if (equipped && heroImage.src !== new URL(skin.image, document.baseURI).href) heroImage.src = skin.image;
    }
    updateHeroMotion();
    if (state.clickLevel !== previousClickLevel || state.autoLevel !== previousAutoLevel || state.equippedSkin !== previousSkin)
      setText(announcement, `${formatNumber(state.points)} puntos. ${formatNumber(pointsPerClick(state))} por clic y ${formatNumber(production(state) * productionMultiplier(p))} por segundo.`);
    previousClickLevel = state.clickLevel;
    previousAutoLevel = state.autoLevel;
    previousSkin = state.equippedSkin;
  }

  function particle(className: string, text: string, x: number, y: number, frames: Keyframe[], duration: number, delay = 0): HTMLElement {
    while (heroFx.childElementCount >= MAX_FX) heroFx.firstElementChild?.remove();
    const node = el('span', `fx ${className}`, text);
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    heroFx.append(node);
    node.animate(frames, { duration, delay, easing: 'ease-out' }).onfinish = () => node.remove();
    return node;
  }

  function burst(effect: TapEffect): void {
    const size = hero.clientWidth || 280;
    if (effect === 'goal') {
      // Tres balones en arco, cada uno con dos estelas.
      for (let i = 0; i < 3; i++) {
        const angle = -90 + (i - 1) * 40 + random(-8, 8);
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad) * size * 0.42;
        const dy = Math.sin(rad) * size * 0.42;
        for (let t = 0; t < 2; t++) {
          const tilt = angle + (t === 0 ? -7 : 7);
          particle('fx--trail', '', fxX, fxY, [
            { opacity: 0, transform: `rotate(${tilt}deg) scaleX(0)` },
            { opacity: 0.85, transform: `rotate(${tilt}deg) scaleX(1)`, offset: 0.35 },
            { opacity: 0, transform: `rotate(${tilt}deg) translateX(${size * 0.24}px) scaleX(0.3)` },
          ], 620, i * 70);
        }
        particle('fx--ball', '⚽', fxX, fxY, [
          { opacity: 0, transform: 'translate(0, 0) rotate(0) scale(0.6)' },
          { opacity: 1, transform: `translate(${dx * 0.75}px, ${dy}px) rotate(300deg) scale(1.15)`, offset: 0.6 },
          { opacity: 0, transform: `translate(${dx}px, ${dy * 0.55}px) rotate(430deg) scale(1)` },
        ], 950, i * 70);
      }
    } else if (effect === 'sparks') {
      for (let i = 0; i < 10; i++) {
        const angle = i * 36 + random(-12, 12);
        particle(`fx--spark${i % 2 ? ' fx--spark-alt' : ''}`, '', fxX, fxY, [
          { opacity: 0, transform: `rotate(${angle}deg) translateX(${size * 0.05}px) scaleX(0.2)` },
          { opacity: 1, transform: `rotate(${angle}deg) translateX(${size * 0.2}px) scaleX(1)`, offset: 0.35 },
          { opacity: 0, transform: `rotate(${angle}deg) translateX(${size * 0.4}px) scaleX(0.15)` },
        ], 560, (i % 3) * 50);
      }
    } else if (effect === 'coffee') {
      for (let i = 0; i < 8; i++) {
        const sway = random(-14, 14);
        const rise = -size * random(0.38, 0.6);
        particle('fx--mug', i % 3 === 2 ? '📎' : '☕', 10 + i * 11.5 + random(-3, 3), 90, [
          { opacity: 0, transform: 'translate(0, 0) rotate(0)' },
          { opacity: 1, transform: `translate(${sway}px, ${rise * 0.4}px) rotate(${sway * 0.6}deg)`, offset: 0.3 },
          { opacity: 0, transform: `translate(${-sway}px, ${rise}px) rotate(${-sway * 0.6}deg)` },
        ], 1300, i * 70);
      }
    } else if (effect === 'chaos') {
      for (let i = 0; i < 14; i++) {
        const card = i % 7 === 0;
        const rad = random(0, Math.PI * 2);
        const reach = size * random(0.22, 0.44);
        const dx = Math.cos(rad) * reach;
        const dy = Math.sin(rad) * reach;
        const spin = random(-420, 420);
        const node = particle(card ? 'fx--card' : 'fx--confetti', card ? '🃏' : '', fxX, fxY, [
          { opacity: 0, transform: 'translate(0, 0) rotate(0) scale(0.5)' },
          { opacity: 1, transform: `translate(${dx}px, ${dy}px) rotate(${spin * 0.6}deg) scale(1)`, offset: 0.45 },
          { opacity: 0, transform: `translate(${dx * 1.15}px, ${dy + size * 0.18}px) rotate(${spin}deg) scale(0.9)` },
        ], 1000, (i % 4) * 30);
        if (!card) node.style.background = CONFETTI[i % CONFETTI.length]!;
      }
    } else if (effect === 'coins') {
      for (let i = 0; i < 12; i++) {
        const fall = size * random(0.7, 1.05);
        particle('fx--coin', '', 7 + ((i * 5) % 12) * 7.8, -4, [
          { opacity: 1, transform: 'translateY(0) scaleX(1)' },
          { opacity: 1, transform: `translateY(${fall * 0.5}px) scaleX(0.35)`, offset: 0.5 },
          { opacity: 0, transform: `translateY(${fall}px) scaleX(1)` },
        ], 1050, i * 45);
      }
    }
  }

  function feedback(amount: number, effect: TapEffect, chain: number): void {
    // Sin puntos: main solo avisa que la racha caducó.
    if (!(amount > 0)) {
      resetCombo();
      return;
    }
    const info = EFFECTS[effect] ?? EFFECTS.none;
    const bonus = info.label !== '';
    const displayed = formatReward(amount);
    const gained = `+${displayed}`;
    setText(announcement, `${bonus ? `${info.label} ` : ''}Ganaste ${displayed} puntos.`);
    setText(comboEvent, bonus ? `${info.label} ${gained}` : '');
    combo.classList.toggle('combo--bonus', bonus);
    showChain(currentSkin ?? 'original', chain, bonus);
    window.clearTimeout(comboTimer);
    comboTimer = window.setTimeout(resetCombo, COMBO_TIMEOUT_MS);

    // Versión fija: sin partículas ni transformaciones.
    if (!effectsOn || prefersReducedMotion() || typeof heroFx.animate !== 'function') {
      hideReactions();
      setText(heroBadge, bonus ? `${info.label} ${gained}` : gained);
      heroBadge.hidden = false;
      window.clearTimeout(badgeTimer);
      badgeTimer = window.setTimeout(() => { heroBadge.hidden = true; }, BADGE_TIMEOUT_MS);
      return;
    }
    heroBadge.hidden = true;
    const floaters = heroFx.getElementsByClassName('hero__floater');
    while (floaters.length >= MAX_FLOATERS) floaters[0]!.remove();
    while (heroFx.childElementCount >= MAX_FX) heroFx.firstElementChild?.remove();
    const floater = el('span', `hero__floater${bonus ? ' hero__floater--bonus' : ''}`, gained);
    floater.style.left = `${fxX}%`;
    floater.style.top = `${fxY}%`;
    heroFx.append(floater);
    const drift = Math.round(random(-18, 18));
    const rise = bonus ? -96 : -72;
    floater.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.8)' },
        { opacity: 1, transform: `translate(-50%, -50%) translate(${drift * 0.3}px, ${rise * 0.3}px) scale(1)`, offset: 0.2 },
        { opacity: 0, transform: `translate(-50%, -50%) translate(${drift}px, ${rise}px) scale(1)` },
      ],
      { duration: bonus ? 1000 : 750, easing: 'ease-out' },
    ).onfinish = () => floater.remove();

    burst(effect);

    // Una sola animación de Michirata a la vez.
    heroAnimation?.cancel();
    heroAnimation = heroButton.animate(info.frames, { duration: info.duration, easing: 'ease-out' });
  }

  function status(message: string): void {
    setText(statusLine, message);
    statusLine.hidden = message === '';
  }
  function celebrate(message: string, animation?: 'face' | 'jump'): void {
    swipe = null;
    purchaseReward.style.transform = '';
    setText(rewardText, `🎉 ${message}`);
    // Sustituye el aviso genérico de render: un solo anuncio por compra.
    setText(announcement, message);
    purchaseReward.hidden = false;
    window.clearTimeout(rewardTimer);
    rewardTimer = window.setTimeout(closeReward, 5000);
    if (effectsOn && !prefersReducedMotion()) {
      if (animation) showCelebration(animation);
      if (typeof heroFx.animate === 'function') burst('chaos');
    }
  }

  function fatigue(factor: number, penalty = false, steady = false) {
    penaltyOn = penalty;
    clickFactor = penalty ? 0 : factor * (steady ? 1.1 : 1);
    setText(perClick, formatReward(baseClickReward * clickFactor));
    setText(perSecond, formatNumber(penalty ? 0 : productionBeforePenalty));
    fatigueNotice.hidden = factor >= 0.95 && !penalty && !steady;
    if (penalty) { setText(fatigueNotice, '🚨 Sobrecalentamiento · −1 %/s · producción pausada'); return; }
    if (steady) { setText(fatigueNotice, '💚 Buen ritmo · clic +10 %'); return; }
    if (!fatigueNotice.hidden) setText(fatigueNotice, `🥵 Clics al ${factor < 0.01 ? '<1' : Math.floor(factor * 100)}% · descansa para recuperar`);
  }
  return { render, feedback, status, celebrate, fatigue };
}
