// Reading plan definitions
// Each plan has 365 days of passages (abbreviated here — full M'Cheyne data)

export type ReadingPlan = {
  id: string;
  title: string;
  description: string;
  icon: string;
  totalDays: number;
  getPassages: (day: number) => string[];
};

// M'Cheyne Bible in a Year — 4 passages/day
const MCCHEYNE: [string, string, string, string][] = [
  ['Genesis 1', 'Matthew 1', 'Ezra 1', 'Acts 1'],
  ['Genesis 2', 'Matthew 2', 'Ezra 2', 'Acts 2'],
  ['Genesis 3', 'Matthew 3', 'Ezra 3', 'Acts 3'],
  ['Genesis 4', 'Matthew 4', 'Ezra 4', 'Acts 4'],
  ['Genesis 5', 'Matthew 5', 'Ezra 5', 'Acts 5'],
  ['Genesis 6', 'Matthew 6', 'Ezra 6', 'Acts 6'],
  ['Genesis 7', 'Matthew 7', 'Ezra 7', 'Acts 7'],
  ['Genesis 8', 'Matthew 8', 'Ezra 8', 'Acts 8'],
  ['Genesis 9-10', 'Matthew 9', 'Ezra 9', 'Acts 9'],
  ['Genesis 11', 'Matthew 10', 'Ezra 10', 'Acts 10'],
  // ... extends to 365 days
];

// NT in a Year — 1 passage/day through NT
const NT_PASSAGES = [
  'Matthew 1', 'Matthew 2', 'Matthew 3', 'Matthew 4', 'Matthew 5',
  'Matthew 6', 'Matthew 7', 'Matthew 8', 'Matthew 9', 'Matthew 10',
  'Matthew 11', 'Matthew 12', 'Matthew 13', 'Matthew 14', 'Matthew 15',
  'Matthew 16', 'Matthew 17', 'Matthew 18', 'Matthew 19', 'Matthew 20',
  'Matthew 21', 'Matthew 22', 'Matthew 23', 'Matthew 24', 'Matthew 25',
  'Matthew 26', 'Matthew 27', 'Matthew 28', 'Mark 1', 'Mark 2',
  'Mark 3', 'Mark 4', 'Mark 5', 'Mark 6', 'Mark 7',
  'Mark 8', 'Mark 9', 'Mark 10', 'Mark 11', 'Mark 12',
  'Mark 13', 'Mark 14', 'Mark 15', 'Mark 16', 'Luke 1',
  'Luke 2', 'Luke 3', 'Luke 4', 'Luke 5', 'Luke 6',
  'Luke 7', 'Luke 8', 'Luke 9', 'Luke 10', 'Luke 11',
  'Luke 12', 'Luke 13', 'Luke 14', 'Luke 15', 'Luke 16',
  'Luke 17', 'Luke 18', 'Luke 19', 'Luke 20', 'Luke 21',
  'Luke 22', 'Luke 23', 'Luke 24', 'John 1', 'John 2',
  'John 3', 'John 4', 'John 5', 'John 6', 'John 7',
  'John 8', 'John 9', 'John 10', 'John 11', 'John 12',
  'John 13', 'John 14', 'John 15', 'John 16', 'John 17',
  'John 18', 'John 19', 'John 20', 'John 21', 'Acts 1',
  'Acts 2', 'Acts 3', 'Acts 4', 'Acts 5', 'Acts 6',
];

// Psalms & Proverbs — alternating
function psalmProverbs(day: number): string[] {
  const psalmNum = ((day - 1) % 150) + 1;
  const provNum = ((day - 1) % 31) + 1;
  return [`Psalm ${psalmNum}`, `Proverbs ${provNum}`];
}

// Gospel Harmony — all 4 gospels in 89 days (cycle)
const GOSPELS = ['Matthew', 'Mark', 'Luke', 'John'];
const GOSPEL_CHAPTERS: Record<string, number> = {
  Matthew: 28, Mark: 16, Luke: 24, John: 21,
};
function gospelHarmony(day: number): string[] {
  let d = ((day - 1) % 89) + 1;
  let book = 0;
  let ch = d;
  for (const g of GOSPELS) {
    if (ch <= GOSPEL_CHAPTERS[g]) return [`${g} ${ch}`];
    ch -= GOSPEL_CHAPTERS[g];
    book++;
  }
  return ['John 21'];
}

export const READING_PLANS: ReadingPlan[] = [
  {
    id: 'mccheyne',
    title: 'Bible in a Year',
    description: 'M\'Cheyne plan — 4 passages daily through the whole Bible',
    icon: '📖',
    totalDays: 365,
    getPassages: (day) => MCCHEYNE[Math.min(day - 1, MCCHEYNE.length - 1)] ?? ['Genesis 1'],
  },
  {
    id: 'nt-year',
    title: 'New Testament in a Year',
    description: 'Through all 27 books of the New Testament',
    icon: '✝️',
    totalDays: 260,
    getPassages: (day) => [NT_PASSAGES[Math.min(day - 1, NT_PASSAGES.length - 1)] ?? 'Revelation 22'],
  },
  {
    id: 'psalms-proverbs',
    title: 'Psalms & Proverbs',
    description: 'Daily wisdom — one Psalm and one Proverb each day',
    icon: '🙏',
    totalDays: 365,
    getPassages: (day) => psalmProverbs(day),
  },
  {
    id: 'ot-year',
    title: 'Old Testament in a Year',
    description: 'Through the entire Old Testament',
    icon: '📜',
    totalDays: 365,
    getPassages: (day) => [`Genesis ${Math.min(day, 50)}`], // simplified
  },
  {
    id: 'gospel-harmony',
    title: 'Gospel Harmony',
    description: 'All four gospels read together in parallel',
    icon: '✨',
    totalDays: 89,
    getPassages: (day) => gospelHarmony(day),
  },
];

export function getPlanById(id: string): ReadingPlan | undefined {
  return READING_PLANS.find((p) => p.id === id);
}

export function getTodayDayNumber(planStartDate: string): number {
  const start = new Date(planStartDate);
  const today = new Date();
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}
