import type { ProviderType } from '@directus/ai';
import { streamText } from 'ai';
import type { LanguageModel } from 'ai';

export interface AIGenerationOptions {
	provider: ProviderType;
	model: string;
	prompt: string;
	temperature?: number;
	maxTokens?: number;
}

export async function generateWithAI(
	languageModel: LanguageModel,
	options: AIGenerationOptions
): Promise<string> {
	const { prompt, temperature = 0.7, maxTokens = 1000 } = options;

	const result = await streamText({
		model: languageModel,
		prompt,
		temperature,
		maxTokens,
	});

	return result.text;
}
