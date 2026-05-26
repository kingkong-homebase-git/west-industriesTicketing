// Short (tongue-in-cheek) motivational quotes shown in the desktop header. A
// new one is picked on each load (see MotivationalQuote.tsx).
export const QUOTES: string[] = [
  "I don't have favorites... but if I did, it'd be whoever fixed the coffee machine.",
  "Teamwork is important. It means I have more people to blame.",
  "I'm not saying I'm the reason this place runs. I'm just saying nobody's tested the theory.",
  "Your overtime is what keeps my weekend plans alive. Thank you for your service.",
  "I trust you all completely — which is why I check everything twice.",
  "We're like a family here. A dysfunctional one with a deadline.",
  "Great job today. Don't let it become a habit, you'll raise expectations.",
  "I'd tell you to work smarter, not harder, but let's start with just one of those.",
  "Mondays are tough, but so am I, so let's suffer together.",
  "Remember: there's no 'I' in team, but there is one in 'I'm the boss.'",
];

export function pickQuote(): string {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
