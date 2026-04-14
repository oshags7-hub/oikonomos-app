import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

type InsightContext = {
  screen: 'dashboard' | 'finance' | 'home' | 'meals' | 'bible' | 'calendar';
  data: Record<string, unknown>;
};

export async function getInsight(ctx: InsightContext): Promise<string> {
  const prompts: Record<InsightContext['screen'], string> = {
    dashboard: `You are Oikonomos, a warm and wise household steward AI.
Given this household snapshot: ${JSON.stringify(ctx.data)}
Write a 2-sentence daily briefing. Be concise, practical, and encouraging.`,
    finance: `You are Oikonomos, a household finance advisor.
Given this financial data: ${JSON.stringify(ctx.data)}
Write a 2-sentence financial insight. Be specific and actionable.`,
    home: `You are Oikonomos, a home maintenance advisor.
Given these home tasks: ${JSON.stringify(ctx.data)}
Write a 2-sentence home maintenance tip. Be seasonal and practical.`,
    meals: `You are Oikonomos, a meal planning assistant.
Given this pantry/meal data: ${JSON.stringify(ctx.data)}
Write a 2-sentence meal planning tip. Mention specific savings if possible.`,
    bible: `You are Oikonomos, a faith companion.
Given today's readings: ${JSON.stringify(ctx.data)}
Write a 2-sentence reflection connecting the readings. Be warm and spiritually encouraging.`,
    calendar: `You are Oikonomos, a scheduling assistant.
Given these upcoming events: ${JSON.stringify(ctx.data)}
Write a 2-sentence scheduling insight. Help prioritize what matters.`,
  };

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompts[ctx.screen] }],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}
