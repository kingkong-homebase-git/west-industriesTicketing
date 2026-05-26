// Short, classy motivational quotes shown in the desktop header. A new one is
// picked on each load (see MotivationalQuote.tsx). Keep them brief so they fit
// on one line in the script font.
export const QUOTES: string[] = [
  "Progress, not perfection.",
  "Small steps, big results.",
  "Done is better than perfect.",
  "Make it happen.",
  "One task at a time.",
  "Focus on what matters.",
  "Start where you are.",
  "Discipline beats motivation.",
  "Dream big, start small.",
  "Today's effort, tomorrow's win.",
  "Keep going, you're closer than you think.",
  "Action cures fear.",
  "Do the hard thing first.",
  "Consistency compounds.",
  "Show up, every day.",
  "Less hustle, more focus.",
  "Build something you're proud of.",
  "Great work takes great care.",
  "Slow is smooth, smooth is fast.",
  "Finish strong.",
  "Your future is built today.",
  "Stay curious, stay hungry.",
  "Excellence is a habit.",
  "Make today count.",
  "Turn plans into progress.",
];

export function pickQuote(): string {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
