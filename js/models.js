/**
 * Atlands — библиотека милых SVG-моделей.
 *
 * Почему SVG, а не PNG/3D:
 *  - идеально чёткие на любом телефоне (Telegram открывает на разных экранах);
 *  - весят копейки, игра запускается мгновенно даже на слабом интернете;
 *  - анимируются кодом: моргание, дыхание, покачивание, прыжок от радости;
 *  - легко перекрашивать (скины) и надевать аксессуары.
 *
 * Каждая модель — функция, возвращающая SVG-строку.
 * Добавить нового питомца = добавить запись в PETS + функцию в RENDERERS.
 */
'use strict';

let __uid = 0;
function uid(prefix) { return `${prefix}${++__uid}`; }

/** Каталог питомцев. bonus — множитель дохода за нажатие. */
const PETS = [
  { id: 'lotti', name: 'Лотти',  species: 'Аксолотль',   price: 0,     bonus: 1.0, desc: 'Главный хранитель острова. Обожает клубнику и обнимашки.', skins: ['pink', 'mint', 'sky', 'lilac'] },
  { id: 'moti',  name: 'Моти',   species: 'Облачный кролик', price: 500,  bonus: 1.2, desc: 'Спит на облаках и приносит удачу тем, кто его гладит.', skins: ['cream', 'pink', 'sky'] },
  { id: 'puf',   name: 'Пуф',    species: 'Черепашка',   price: 1500,  bonus: 1.4, desc: 'Никуда не спешит. Его панцирь — маленький сад.', skins: ['green', 'sand', 'mint'] },
  { id: 'kiwi',  name: 'Киви',   species: 'Птичка',      price: 4000,  bonus: 1.7, desc: 'Поёт по утрам и собирает блестяшки для острова.', skins: ['sunny', 'sky', 'pink'] },
  { id: 'blob',  name: 'Блоб',   species: 'Осьминожка',  price: 10000, bonus: 2.0, desc: 'Восемь лапок — восемь объятий одновременно.', skins: ['lilac', 'pink', 'mint'] },
  { id: 'mimi',  name: 'Мими',   species: 'Лунная кошечка', price: 25000, bonus: 2.5, desc: 'Приходит с луной и мурчит так, что остров светится.', skins: ['night', 'cream', 'lilac'] },
];

const SKIN_COLORS = {
  pink:  ['#ffd6e8', '#ff9ec4', '#ff6fa5'],
  mint:  ['#d9fbe8', '#8fe3b4', '#4ec98a'],
  sky:   ['#d6efff', '#93d2ff', '#57a8f0'],
  lilac: ['#eadcff', '#c4a6ff', '#9a74f0'],
  cream: ['#fff3d9', '#ffd98f', '#f5b94e'],
  green: ['#e2f9d2', '#a5e07f', '#6fbf4a'],
  sand:  ['#fdeeca', '#f2cd8a', '#d9a24d'],
  sunny: ['#fff6bf', '#ffe066', '#ffb703'],
  night: ['#dfe4ff', '#8f9bf0', '#5a67c9'],
};

/** Аксессуары (открываются за уровни, см. game.js). */
const ACCESSORIES = [
  { id: 'none',  name: 'Без аксессуара', icon: '—',    unlockLevel: 1 },
  { id: 'flower', name: 'Цветочек',       icon: '🌼', unlockLevel: 1 },
  { id: 'bow',    name: 'Бантик',         icon: '🎀', unlockLevel: 3 },
  { id: 'star',   name: 'Звёздочка',      icon: '⭐', unlockLevel: 5 },
  { id: 'crown',  name: 'Коронка',        icon: '👑', unlockLevel: 8 },
];

function accessorySVG(acc, x = 118, y = 34) {
  switch (acc) {
    case 'flower': return `<g class="acc" transform="translate(${x} ${y})">
      <g fill="#fff"><ellipse rx="6" ry="10"/><ellipse rx="6" ry="10" transform="rotate(72)"/><ellipse rx="6" ry="10" transform="rotate(144)"/><ellipse rx="6" ry="10" transform="rotate(216)"/><ellipse rx="6" ry="10" transform="rotate(288)"/></g>
      <circle r="5.5" fill="#ffb703"/></g>`;
    case 'bow': return `<g class="acc" transform="translate(${x} ${y})">
      <path d="M0 0 L-16 -9 Q-20 0 -16 9 Z M0 0 L16 -9 Q20 0 16 9 Z" fill="#ff5d8f" stroke="#e1437e" stroke-width="1.5"/><circle r="4.5" fill="#e1437e"/></g>`;
    case 'star': return `<g class="acc" transform="translate(${x} ${y})"><path d="M0 -11 L3 -3.5 L11 -3 L4.5 1.8 L6.8 9.5 L0 5 L-6.8 9.5 L-4.5 1.8 L-11 -3 L-3 -3.5 Z" fill="#ffd60a" stroke="#f0a202" stroke-width="1.4" stroke-linejoin="round"/></g>`;
    case 'crown': return `<g class="acc" transform="translate(${x} ${y + 4})"><path d="M-16 8 L-13 -8 L-5 1 L0 -11 L5 1 L13 -8 L16 8 Z" fill="#ffd60a" stroke="#f0a202" stroke-width="1.6" stroke-linejoin="round"/><circle cy="-11" r="2.6" fill="#ff5d8f"/><circle cx="-13" cy="-8" r="2.2" fill="#57a8f0"/><circle cx="13" cy="-8" r="2.2" fill="#57a8f0"/></g>`;
    default: return '';
  }
}

/** Общие части: глаза с морганием, румянец, ротик. cx — центр мордочки, cy — высота глаз. */
function face(cx, cy, { eyeR = 6.5, mouth = 'smile' } = {}) {
  const mouthPath = mouth === 'o'
    ? `<ellipse class="pet-mouth" cx="${cx}" cy="${cy + 16}" rx="4" ry="5" fill="#8a3b5e"/>`
    : `<path class="pet-mouth" d="M${cx - 6} ${cy + 13} Q${cx} ${cy + 20} ${cx + 6} ${cy + 13}" fill="none" stroke="#8a3b5e" stroke-width="2.6" stroke-linecap="round"/>`;
  return `
  <ellipse cx="${cx - 27}" cy="${cy + 12}" rx="10" ry="6" fill="#ff8fab" opacity=".55"/>
  <ellipse cx="${cx + 27}" cy="${cy + 12}" rx="10" ry="6" fill="#ff8fab" opacity=".55"/>
  <g class="pet-eyes">
    <circle cx="${cx - 15}" cy="${cy}" r="${eyeR}" fill="#38222e"/>
    <circle cx="${cx + 15}" cy="${cy}" r="${eyeR}" fill="#38222e"/>
    <circle cx="${cx - 15 + eyeR * .35}" cy="${cy - eyeR * .35}" r="${eyeR * .38}" fill="#fff"/>
    <circle cx="${cx + 15 + eyeR * .35}" cy="${cy - eyeR * .35}" r="${eyeR * .38}" fill="#fff"/>
  </g>${mouthPath}`;
}

const RENDERERS = {
  lotti(c, acc, g) { return `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <ellipse cx="100" cy="168" rx="52" ry="10" fill="#000" opacity=".10"/>
    <g class="pet-body">
      <g stroke="${c[2]}" stroke-width="7" stroke-linecap="round" fill="none">
        <path d="M52 62 Q30 52 26 38"/><path d="M54 78 Q30 76 24 66"/><path d="M55 94 Q34 98 27 90"/>
        <path d="M148 62 Q170 52 174 38"/><path d="M146 78 Q170 76 176 66"/><path d="M145 94 Q166 98 173 90"/>
      </g>
      <g fill="${c[1]}"><circle cx="27" cy="36" r="7"/><circle cx="24" cy="65" r="7"/><circle cx="28" cy="90" r="7"/>
      <circle cx="173" cy="36" r="7"/><circle cx="176" cy="65" r="7"/><circle cx="172" cy="90" r="7"/></g>
      <path d="M58 78 Q58 44 100 44 Q142 44 142 78 Q146 128 128 150 Q100 164 72 150 Q54 128 58 78Z" fill="url(#${g})"/>
      <ellipse cx="100" cy="132" rx="26" ry="20" fill="#fff" opacity=".55"/>
      <path d="M74 156 Q100 168 126 156 L132 168 Q100 178 68 168Z" fill="${c[2]}" opacity=".8"/>
      ${face(100, 92)}${accessorySVG(acc, 128, 46)}
    </g>`; },

  moti(c, acc, g) { return `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <ellipse cx="100" cy="168" rx="48" ry="10" fill="#000" opacity=".10"/>
    <g class="pet-body">
      <path d="M72 52 Q58 14 74 10 Q90 8 88 44Z" fill="url(#${g})" stroke="${c[2]}" stroke-width="2"/>
      <path d="M128 52 Q142 14 126 10 Q110 8 112 44Z" fill="url(#${g})" stroke="${c[2]}" stroke-width="2"/>
      <path d="M74 42 Q68 22 75 18 M126 42 Q132 22 125 18" stroke="#ff9ec4" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="100" cy="112" rx="52" ry="52" fill="url(#${g})"/>
      <ellipse cx="100" cy="132" rx="27" ry="22" fill="#fff" opacity=".6"/>
      <circle cx="52" cy="128" r="12" fill="#fff" opacity=".75"/><circle cx="150" cy="122" r="14" fill="#fff" opacity=".75"/>
      ${face(100, 104)}<path d="M97 113 h6" stroke="#8a3b5e" stroke-width="2.4" stroke-linecap="round"/>
      ${accessorySVG(acc, 130, 52)}
    </g>`; },

  puf(c, acc, g) { return `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <ellipse cx="100" cy="168" rx="56" ry="10" fill="#000" opacity=".10"/>
    <g class="pet-body">
      <ellipse cx="52" cy="150" rx="14" ry="9" fill="${c[2]}"/><ellipse cx="148" cy="150" rx="14" ry="9" fill="${c[2]}"/>
      <path d="M42 148 Q42 96 100 94 Q158 96 158 148 Q100 162 42 148Z" fill="url(#${g})" stroke="${c[2]}" stroke-width="2"/>
      <path d="M70 104 Q100 96 130 104 M62 126 Q100 116 138 126" stroke="${c[2]}" stroke-width="2.4" fill="none" opacity=".6"/>
      <circle cx="84" cy="112" r="4" fill="#ff8fab"/><circle cx="112" cy="106" r="4.6" fill="#ffd60a"/><circle cx="122" cy="124" r="3.6" fill="#ff8fab"/>
      <path d="M82 96 Q84 80 94 76 M104 94 Q108 80 116 78" stroke="#4ec98a" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <circle cx="152" cy="98" r="24" fill="${c[0]}" stroke="${c[2]}" stroke-width="2"/>
      ${face(152, 94, { eyeR: 5 })}${accessorySVG(acc, 162, 74)}
    </g>`; },

  kiwi(c, acc, g) { return `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <ellipse cx="100" cy="168" rx="44" ry="9" fill="#000" opacity=".10"/>
    <g class="pet-body">
      <path class="pet-wing-l" d="M52 108 Q26 100 30 82 Q52 82 60 98Z" fill="${c[2]}"/>
      <path class="pet-wing-r" d="M148 108 Q174 100 170 82 Q148 82 140 98Z" fill="${c[2]}"/>
      <ellipse cx="100" cy="112" rx="48" ry="52" fill="url(#${g})"/>
      <ellipse cx="100" cy="134" rx="25" ry="20" fill="#fff" opacity=".6"/>
      <path d="M88 62 Q94 44 104 52 Q102 62 106 50 Q116 46 112 64" stroke="${c[2]}" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${face(100, 98, { mouth: 'o' })}
      <path d="M92 112 L108 112 L100 122Z" fill="#ff9f1c" stroke="#e07f00" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M86 162 l-4 7 M114 162 l4 7" stroke="#e07f00" stroke-width="3" stroke-linecap="round"/>
      ${accessorySVG(acc, 128, 58)}
    </g>`; },

  blob(c, acc, g) { return `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <ellipse cx="100" cy="170" rx="56" ry="9" fill="#000" opacity=".10"/>
    <g class="pet-body">
      <g fill="${c[1]}" stroke="${c[2]}" stroke-width="2">
        <path d="M52 138 Q34 152 40 164 Q54 162 60 148Z"/><path d="M76 152 Q66 168 76 172 Q88 166 88 154Z"/>
        <path d="M124 152 Q134 168 124 172 Q112 166 112 154Z"/><path d="M148 138 Q166 152 160 164 Q146 162 140 148Z"/>
      </g>
      <path d="M50 106 Q50 58 100 56 Q150 58 150 106 Q150 150 100 152 Q50 150 50 106Z" fill="url(#${g})"/>
      <circle cx="74" cy="86" r="5" fill="#fff" opacity=".5"/><circle cx="128" cy="80" r="3.6" fill="#fff" opacity=".5"/><circle cx="120" cy="128" r="4.4" fill="#fff" opacity=".4"/>
      ${face(100, 100)}${accessorySVG(acc, 126, 58)}
    </g>`; },

  mimi(c, acc, g) { return `
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <ellipse cx="100" cy="168" rx="48" ry="10" fill="#000" opacity=".10"/>
    <g class="pet-body">
      <path d="M148 140 Q178 132 172 106" stroke="${c[2]}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M64 58 L56 26 L86 42 M136 58 L144 26 L114 42" fill="url(#${g})" stroke="${c[2]}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M66 50 L62 36 L76 44 M134 50 L138 36 L124 44" fill="#ff9ec4"/>
      <ellipse cx="100" cy="112" rx="50" ry="52" fill="url(#${g})"/>
      <ellipse cx="100" cy="134" rx="25" ry="20" fill="#fff" opacity=".55"/>
      <path d="M64 104 h14 M66 116 l12 -3 M136 104 h-14 M134 116 l-12 -3" stroke="#8a6d7a" stroke-width="2" stroke-linecap="round" opacity=".7"/>
      ${face(100, 102)}<path d="M96 116 Q100 119 104 116" fill="none" stroke="#8a3b5e" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M126 66 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8Z" fill="#ffd60a"/>
      ${accessorySVG(acc, 128, 52)}
    </g>`; },
};

/**
 * Главная функция модели.
 * @param {string} petId  id из PETS
 * @param {{skin?:string, accessory?:string, className?:string}} [opts]
 * @returns {string} SVG-разметка 200x180
 */
function petSVG(petId, opts = {}) {
  const pet = PETS.find(p => p.id === petId) || PETS[0];
  const skin = pet.skins.includes(opts.skin) ? opts.skin : pet.skins[0];
  const colors = SKIN_COLORS[skin] || SKIN_COLORS.pink;
  const g = uid('g');
  const body = (RENDERERS[pet.id] || RENDERERS.lotti)(colors, opts.accessory || 'none', g);
  return `<svg class="pet-svg ${opts.className || ''}" viewBox="0 0 200 180" role="img" aria-label="${pet.name}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

/** Иконки декораций острова (тоже векторные модели, показываются на острове по количеству). */
const DECORATIONS = [
  { id: 'flower',    name: 'Цветочная клумба', icon: '🌼', baseCost: 15,    costGrowth: 1.15, perSec: 0.3, desc: '+0.3 искры/сек' },
  { id: 'mushroom',  name: 'Грибной домик',    icon: '🍄', baseCost: 60,    costGrowth: 1.15, perSec: 1,   desc: '+1 искра/сек' },
  { id: 'tree',      name: 'Сакуровое дерево', icon: '🌸', baseCost: 250,   costGrowth: 1.16, perSec: 4,   desc: '+4 искры/сек' },
  { id: 'lantern',   name: 'Фонарики',         icon: '🏮', baseCost: 1000,  costGrowth: 1.16, perSec: 15,  desc: '+15 искр/сек' },
  { id: 'crystal',   name: 'Кристалл света',   icon: '🔮', baseCost: 4500,  costGrowth: 1.17, perSec: 60,  desc: '+60 искр/сек' },
  { id: 'waterfall', name: 'Радужный водопад', icon: '🌈', baseCost: 20000, costGrowth: 1.18, perSec: 260, desc: '+260 искр/сек' },
];

const ISLAND_STAGES = [
  { level: 1,  name: 'Крошечный островок' },
  { level: 3,  name: 'Цветущий остров' },
  { level: 5,  name: 'Уютная гавань' },
  { level: 8,  name: 'Светящийся Атланд' },
  { level: 12, name: 'Легенда Атлантиды' },
];

function islandStageName(level) {
  let name = ISLAND_STAGES[0].name;
  for (const s of ISLAND_STAGES) if (level >= s.level) name = s.name;
  return name;
}

// Явный экспорт в window: чтобы другие скрипты не зависели от порядка загрузки.
window.PETS = PETS;
window.SKIN_COLORS = SKIN_COLORS;
window.ACCESSORIES = ACCESSORIES;
window.DECORATIONS = DECORATIONS;
window.ISLAND_STAGES = ISLAND_STAGES;
window.petSVG = petSVG;
window.islandStageName = islandStageName;
