export type Profile = 'mom' | 'dad';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  borderLight: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentDim: string;
  sage: string;
  sageDim: string;
  terracotta: string;
  terracottaDim: string;
  heroBackground: string;
  heroText: string;
  heroSub: string;
  heroStat: string;
  tabBar: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;
  inputBackground: string;
  inputBorder: string;
  modalBackground: string;
  modalOverlay: string;
  // Chips
  chipGreenBg: string;
  chipGreenText: string;
  chipAmberBg: string;
  chipAmberText: string;
  chipRedBg: string;
  chipRedText: string;
  chipNeutralBg: string;
  chipNeutralText: string;
  chipPurpleBg: string;
  chipPurpleText: string;
  chipSageBg: string;
  chipSageText: string;
  // Feature-specific
  verseBackground: string;
  verseBorder: string;
  verseLabel: string;
  verseText: string;
  verseRef: string;
  aiBackground: string;
  aiBorder: string;
  aiLabel: string;
  aiText: string;
  aiDot: string;
  aiDotIcon: string;
  progressBar: string;
  progressBg: string;
  // Onboarding
  onboardingDot: string;
  onboardingDotActive: string;
};

export const MomTheme: ThemeColors = {
  // Warm cream base — apple.com-inspired minimal
  background: '#FDFCF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F4EF',
  surfaceRaised: '#FFFFFF',
  border: '#EDE6DC',
  borderLight: '#F2ECE4',
  text: '#1C1410',
  textSub: '#8A7060',
  textMuted: '#C4B8AC',
  // Terracotta primary accent
  accent: '#C07B5A',
  accentSoft: '#F5EDE6',
  accentDim: 'rgba(192, 123, 90, 0.12)',
  // Sage green secondary
  sage: '#7A9068',
  sageDim: 'rgba(122, 144, 104, 0.12)',
  terracotta: '#C07B5A',
  terracottaDim: 'rgba(192, 123, 90, 0.12)',
  // Hero card (dark)
  heroBackground: '#1C1410',
  heroText: '#FDFCF8',
  heroSub: 'rgba(253, 252, 248, 0.45)',
  heroStat: 'rgba(253, 252, 248, 0.07)',
  // Tab bar
  tabBar: '#FFFFFF',
  tabBarBorder: '#EDE6DC',
  tabActive: '#C07B5A',
  tabInactive: '#C4B8AC',
  // Inputs
  inputBackground: '#F7F4EF',
  inputBorder: '#EDE6DC',
  modalBackground: '#FFFFFF',
  modalOverlay: 'rgba(28, 20, 16, 0.45)',
  // Chips
  chipGreenBg: '#EBF2E8',
  chipGreenText: '#3D6B35',
  chipAmberBg: '#F7EDD8',
  chipAmberText: '#8B5E2A',
  chipRedBg: '#F5E8E8',
  chipRedText: '#8B3030',
  chipNeutralBg: '#F0EBE3',
  chipNeutralText: '#8B7260',
  chipPurpleBg: '#EDE8F5',
  chipPurpleText: '#5E3A8B',
  chipSageBg: '#EAF0E6',
  chipSageText: '#3D6B35',
  // Bible / Verse
  verseBackground: '#F5F0F8',
  verseBorder: '#DDD0EC',
  verseLabel: '#7B5EA7',
  verseText: '#2C1F3D',
  verseRef: '#C07B5A',
  // AI card
  aiBackground: '#FBF8F4',
  aiBorder: '#EDE6DC',
  aiLabel: '#C07B5A',
  aiText: '#6B5040',
  aiDot: '#C07B5A',
  aiDotIcon: '#FFFFFF',
  // Progress
  progressBar: '#7B5EA7',
  progressBg: '#EDE6DC',
  // Onboarding
  onboardingDot: '#EDE6DC',
  onboardingDotActive: '#C07B5A',
};

export const DadTheme: ThemeColors = {
  background: '#0D1117',
  surface: '#161B27',
  surfaceAlt: '#161B27',
  surfaceRaised: '#1E2436',
  border: '#1E2330',
  borderLight: '#1A2030',
  text: '#E8E2D6',
  textSub: '#5A6478',
  textMuted: '#2A3345',
  accent: '#4E9BF5',
  accentSoft: 'rgba(78,155,245,0.1)',
  accentDim: 'rgba(78, 155, 245, 0.12)',
  sage: '#4CAF7A',
  sageDim: 'rgba(76, 175, 122, 0.12)',
  terracotta: '#E08060',
  terracottaDim: 'rgba(224, 128, 96, 0.12)',
  heroBackground: '#161B27',
  heroText: '#FAF8F4',
  heroSub: 'rgba(255,255,255,0.4)',
  heroStat: 'rgba(255,255,255,0.06)',
  tabBar: '#0D1117',
  tabBarBorder: '#1E2330',
  tabActive: '#4E9BF5',
  tabInactive: '#2A3345',
  inputBackground: '#0D1117',
  inputBorder: '#1E2330',
  modalBackground: '#161B27',
  modalOverlay: 'rgba(0,0,0,0.6)',
  chipGreenBg: 'rgba(57,197,110,0.1)',
  chipGreenText: '#39C56E',
  chipAmberBg: 'rgba(245,183,78,0.1)',
  chipAmberText: '#F5B74E',
  chipRedBg: 'rgba(245,91,78,0.1)',
  chipRedText: '#F55B4E',
  chipNeutralBg: '#1A2030',
  chipNeutralText: '#5A6478',
  chipPurpleBg: 'rgba(147,91,245,0.1)',
  chipPurpleText: '#935BF5',
  chipSageBg: 'rgba(76,175,122,0.1)',
  chipSageText: '#4CAF7A',
  verseBackground: 'rgba(147,91,245,0.08)',
  verseBorder: 'rgba(147,91,245,0.2)',
  verseLabel: '#935BF5',
  verseText: '#C9D1D9',
  verseRef: '#4E9BF5',
  aiBackground: '#161B27',
  aiBorder: '#1E2736',
  aiLabel: '#4E9BF5',
  aiText: '#5A6478',
  aiDot: '#1E2736',
  aiDotIcon: '#4E9BF5',
  progressBar: '#238636',
  progressBg: '#1A2030',
  onboardingDot: '#1E2330',
  onboardingDotActive: '#4E9BF5',
};

export function getTheme(profile: Profile): ThemeColors {
  return profile === 'mom' ? MomTheme : DadTheme;
}
