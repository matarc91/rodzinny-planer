export const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

export const APP_VERSION = 'v3.1.0';

export const COLORS = {
  bg: '#121214',
  surface: '#1E1E22',
  surfaceHighlight: '#2A2A30',
  ink: '#F3F3F5',
  inkSoft: '#A0A0AB',
  border: '#33333C',
  success: '#4E9A58',
  warn: '#E57373',
  accent: '#E2B053',
  accentSoft: '#2C271D',
};

export const PERSON_PALETTE = [
  '#5B8FF9',
  '#F65D79',
  '#5AD8A6',
  '#A770EF',
  '#F6BD16',
  '#6DC8EC',
  '#FF9D4D',
  '#36B37E',
];

export const AVATAR_EMOJIS = ['👨', '👩', '👧', '👦', '👶', '👵', '👴', '🐕', '🐈', '⭐'];

export const CARD_COLORS = ['#2C271D', '#1F2A38', '#2C1F2B', '#1D2C24', '#2E221E'];

export const WEEKDAYS = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];

export const MONTHS = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
];

export const REMINDER_OPTIONS = [
  { hours: null, label: 'Brak przypomnienia' },
  { hours: 0, label: 'O czasie wydarzenia' },
  { hours: 1, label: '1 godz. przed' },
  { hours: 2, label: '2 godz. przed' },
  { hours: 24, label: '1 dzień przed' },
];

export const RECURRENCE_LABELS = {
  none: 'Jednorazowo',
  daily: 'Codziennie',
  weekly: 'Co tydzień',
  biweekly: 'Co 2 tyg.',
  quadweekly: 'Co 4 tyg.',
};

export function reminderLabel(hours) {
  const opt = REMINDER_OPTIONS.find((o) => o.hours === hours);
  return opt ? opt.label : 'Brak';
}

export function uid(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

export function createDefaultMonthBudget() {
  return {
    incomes: [
      { id: 'inc_1', title: 'Wypłata', amount: 7000 },
      { id: 'inc_2', title: 'Działalność', amount: 3500 },
    ],
    fixedCosts: [
      { id: 'fc_1', title: 'Czynsz/Media', amount: 1200 },
      { id: 'fc_2', title: 'Leasing/Koszty firmowe', amount: 1800 },
    ],
    categories: [
      { id: 'cat_1', name: 'Jedzenie i Dom', limit: 2500, icon: '🛒' },
      { id: 'cat_2', name: 'Wydatki na dziecko', limit: 800, icon: '👶' },
      { id: 'cat_3', name: 'Pies', limit: 400, icon: '🐕' },
      { id: 'cat_4', name: 'Remont domku', limit: 1500, icon: '🔨' },
    ],
    expenses: [],
  };
}

export function createDefaultBudgetGoals() {
  return [
    {
      id: 'goal_1',
      name: 'Oszczędności',
      targetAmount: null, // cel bez limitu (nieskończoność)
      icon: '💰',
      isCompleted: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'goal_2',
      name: 'Wakacje',
      targetAmount: 6000,
      icon: '🏖️',
      isCompleted: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function emptyData() {
  const currentMonthKey = new Date().toISOString().slice(0, 7); // np. '2026-08'
  return {
    lastUpdatedAt: Date.now(),
    people: [
      { id: 'p_1', name: 'Mama', color: '#F65D79', emoji: '👩' },
      { id: 'p_2', name: 'Tata', color: '#5B8FF9', emoji: '👨' },
    ],
    events: [],
    tasks: [],
    notes: [],
    wall: [],
    meals: {},
    budget: {
      [currentMonthKey]: createDefaultMonthBudget(),
    },
    budgetGoals: createDefaultBudgetGoals(),
    settings: { enableMeals: true, enableWall: true, enableBudget: true },
  };
}
