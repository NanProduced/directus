import { defineHook } from '@directus/extensions-sdk';
import type { FilterHandler } from '@directus/types';
import type { ProviderType } from '@directus/ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { parseTemplate } from './utils/template-parser.js';

interface AIAutoFieldOptions {
	promptTemplate?: string;
	aiProvider?: ProviderType;
	aiModel?: string;
	temperature?: number;
	maxTokens?: number;
	triggerOnCreate?: boolean;
	triggerOnUpdate?: boolean;
	regenerateIfEmpty?: boolean;
	allowManualRegeneration?: boolean;
}

interface FieldWithMeta {
	field: string;
	meta?: {
		interface?: string;
		options?: AIAutoFieldOptions;
	} | null;
}

export default defineHook(({ filter }, context) => {
	const { getSchema, logger, env } = context;

	const getLanguageModel = (provider: ProviderType, model: string) => {
		switch (provider) {
			case 'openai': {
				const apiKey = env['AI_OPENAI_API_KEY'] as string;
				if (!apiKey) {
					throw new Error('OpenAI API key not configured');
				}
				const openai = createOpenAI({ apiKey });
				return openai(model);
			}
			case 'anthropic': {
				const apiKey = env['AI_ANTHROPIC_API_KEY'] as string;
				if (!apiKey) {
					throw new Error('Anthropic API key not configured');
				}
				const anthropic = createOpenAI({
					apiKey,
					baseURL: 'https://api.anthropic.com/v1',
				});
				return anthropic(model);
			}
			case 'google': {
				const apiKey = env['AI_GOOGLE_API_KEY'] as string;
				if (!apiKey) {
					throw new Error('Google API key not configured');
				}
				const google = createGoogleGenerativeAI({ apiKey });
				return google(model);
			}
			case 'openai-compatible': {
				const apiKey = env['AI_OPENAI_COMPATIBLE_API_KEY'] as string;
				const baseUrl = env['AI_OPENAI_COMPATIBLE_BASE_URL'] as string;
				if (!apiKey || !baseUrl) {
					throw new Error('OpenAI compatible API key or base URL not configured');
				}
				const openaiCompatible = createOpenAICompatible({
					apiKey,
					baseURL: baseUrl,
				});
				return openaiCompatible(model);
			}
			default:
				throw new Error(`Unsupported AI provider: ${provider}`);
		}
	};

	const generateWithAI = async (
		provider: ProviderType,
		model: string,
		prompt: string,
		temperature: number,
		maxTokens: number
	): Promise<string> => {
		const languageModel = getLanguageModel(provider, model);

		const result = await streamText({
			model: languageModel,
			prompt,
			temperature,
			maxTokens,
		});

		return result.text;
	};

	const handleItemsEvent: FilterHandler<Record<string, unknown>> = async (
		payload,
		{ collection, event }
	) => {
		try {
			const schema = await getSchema();
			const collectionFields = schema.collections[collection]?.fields;

			if (!collectionFields) {
				return payload;
			}

			const aiAutoFields: FieldWithMeta[] = [];

			for (const [fieldName, fieldConfig] of Object.entries(collectionFields)) {
				const meta = fieldConfig.meta;
				if (meta?.interface === 'ai-auto-field') {
					aiAutoFields.push({
						field: fieldName,
						meta: {
							interface: meta.interface,
							options: meta.options as AIAutoFieldOptions,
						},
					});
				}
			}

			if (aiAutoFields.length === 0) {
				return payload;
			}

			const isCreate = event.includes('create');
			const isUpdate = event.includes('update');

			const updatedPayload = { ...payload };

			for (const aiField of aiAutoFields) {
				const options = aiField.meta?.options || {};
				const {
					promptTemplate,
					aiProvider = 'openai',
					aiModel = 'gpt-4o-mini',
					temperature = 0.7,
					maxTokens = 1000,
					triggerOnCreate = true,
					triggerOnUpdate = false,
					regenerateIfEmpty = true,
				} = options;

				if (!promptTemplate) {
					continue;
				}

				if (isCreate && !triggerOnCreate) {
					continue;
				}

				if (isUpdate && !triggerOnUpdate) {
					continue;
				}

				const currentValue = updatedPayload[aiField.field];
				if (regenerateIfEmpty && currentValue !== null && currentValue !== undefined && currentValue !== '') {
					continue;
				}

				const processedPrompt = parseTemplate(promptTemplate, updatedPayload as Record<string, unknown>);

				if (!processedPrompt.trim()) {
					continue;
				}

				try {
					const generatedText = await generateWithAI(
						aiProvider,
						aiModel,
						processedPrompt,
						temperature,
						maxTokens
					);

					updatedPayload[aiField.field] = generatedText;

					logger.info(`AI generated content for field ${aiField.field} in collection ${collection}`);
				} catch (error) {
					logger.error(`Failed to generate AI content for field ${aiField.field}:`, error);
				}
			}

			return updatedPayload;
		} catch (error) {
			logger.error('Error in AI auto field hook:', error);
			return payload;
		}
	};

	filter('items.create', handleItemsEvent);
	filter('items.update', handleItemsEvent);

	filter('*.items.create', handleItemsEvent);
	filter('*.items.update', handleItemsEvent);
});
