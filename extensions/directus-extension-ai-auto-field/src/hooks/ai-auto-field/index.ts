import { defineHook } from '@directus/extensions-sdk';
import type { FilterHandler, AbstractServiceOptions } from '@directus/types';
import type { ProviderType } from '@directus/ai';
import type { OpenAICompatibleHeader, OpenAICompatibleModel } from '@directus/ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createProviderRegistry, streamText } from 'ai';
import { parseTemplate } from './utils/template-parser.js';

interface AISettings {
	openaiApiKey: string | null;
	anthropicApiKey: string | null;
	googleApiKey: string | null;
	openaiCompatibleApiKey: string | null;
	openaiCompatibleBaseUrl: string | null;
	openaiCompatibleName: string | null;
	openaiCompatibleModels: OpenAICompatibleModel[] | null;
	openaiCompatibleHeaders: OpenAICompatibleHeader[] | null;
	openaiAllowedModels: string[] | null;
	anthropicAllowedModels: string[] | null;
	googleAllowedModels: string[] | null;
	systemPrompt: string | null;
}

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

function buildProviderConfigs(settings: AISettings) {
	const configs = [];

	if (settings.openaiApiKey) {
		configs.push({
			type: 'openai' as const,
			apiKey: settings.openaiApiKey,
		});
	}

	if (settings.anthropicApiKey) {
		configs.push({
			type: 'anthropic' as const,
			apiKey: settings.anthropicApiKey,
		});
	}

	if (settings.googleApiKey) {
		configs.push({
			type: 'google' as const,
			apiKey: settings.googleApiKey,
		});
	}

	if (settings.openaiCompatibleApiKey && settings.openaiCompatibleBaseUrl) {
		configs.push({
			type: 'openai-compatible' as const,
			apiKey: settings.openaiCompatibleApiKey,
			baseUrl: settings.openaiCompatibleBaseUrl,
		});
	}

	return configs;
}

function createAIProviderRegistry(configs: ReturnType<typeof buildProviderConfigs>, settings: AISettings) {
	const providers: Parameters<typeof createProviderRegistry>[0] = {};

	for (const config of configs) {
		switch (config.type) {
			case 'openai':
				providers['openai'] = createOpenAI({ apiKey: config.apiKey });
				break;
			case 'anthropic':
				providers['anthropic'] = createOpenAI({
					apiKey: config.apiKey,
					baseURL: 'https://api.anthropic.com/v1',
				});
				break;
			case 'google':
				providers['google'] = createGoogleGenerativeAI({ apiKey: config.apiKey });
				break;
			case 'openai-compatible':
				if (config.baseUrl) {
					const customHeaders = Object.fromEntries(
						settings.openaiCompatibleHeaders?.map(({ header, value }) => [header, value]) ?? [],
					);

					providers['openai-compatible'] = createOpenAICompatible({
						name: settings.openaiCompatibleName ?? 'openai-compatible',
						apiKey: config.apiKey,
						baseURL: config.baseUrl,
						headers: customHeaders,
					});
				}
				break;
		}
	}

	return createProviderRegistry(providers);
}

export default defineHook(({ filter }, context) => {
	const { services, getSchema, logger, database } = context;

	let cachedAISettings: AISettings | null = null;
	let cacheTime = 0;
	const CACHE_DURATION = 60000;

	async function getAISettings(): Promise<AISettings> {
		const now = Date.now();

		if (cachedAISettings && now - cacheTime < CACHE_DURATION) {
			return cachedAISettings;
		}

		try {
			const schema = await getSchema();
			const settingsService = new services.SettingsService({
				schema,
				knex: database,
			} as AbstractServiceOptions);

			const settings = await settingsService.readSingleton({
				fields: [
					'ai_openai_api_key',
					'ai_anthropic_api_key',
					'ai_google_api_key',
					'ai_openai_compatible_api_key',
					'ai_openai_compatible_base_url',
					'ai_openai_compatible_name',
					'ai_openai_compatible_models',
					'ai_openai_compatible_headers',
					'ai_openai_allowed_models',
					'ai_anthropic_allowed_models',
					'ai_google_allowed_models',
					'ai_system_prompt',
				],
			});

			cachedAISettings = {
				openaiApiKey: settings['ai_openai_api_key'] ?? null,
				anthropicApiKey: settings['ai_anthropic_api_key'] ?? null,
				googleApiKey: settings['ai_google_api_key'] ?? null,
				openaiCompatibleApiKey: settings['ai_openai_compatible_api_key'] ?? null,
				openaiCompatibleBaseUrl: settings['ai_openai_compatible_base_url'] ?? null,
				openaiCompatibleName: settings['ai_openai_compatible_name'] ?? null,
				openaiCompatibleModels: settings['ai_openai_compatible_models'] ?? null,
				openaiCompatibleHeaders: settings['ai_openai_compatible_headers'] ?? null,
				openaiAllowedModels: settings['ai_openai_allowed_models'] ?? null,
				anthropicAllowedModels: settings['ai_anthropic_allowed_models'] ?? null,
				googleAllowedModels: settings['ai_google_allowed_models'] ?? null,
				systemPrompt: settings['ai_system_prompt'] ?? null,
			};

			cacheTime = now;

			return cachedAISettings;
		} catch (error) {
			logger.error('Failed to load AI settings:', error);
			return {
				openaiApiKey: null,
				anthropicApiKey: null,
				googleApiKey: null,
				openaiCompatibleApiKey: null,
				openaiCompatibleBaseUrl: null,
				openaiCompatibleName: null,
				openaiCompatibleModels: null,
				openaiCompatibleHeaders: null,
				openaiAllowedModels: null,
				anthropicAllowedModels: null,
				googleAllowedModels: null,
				systemPrompt: null,
			};
		}
	}

	async function generateWithAI(
		aiSettings: AISettings,
		provider: ProviderType,
		model: string,
		prompt: string,
		temperature: number,
		maxTokens: number
	): Promise<string> {
		const configs = buildProviderConfigs(aiSettings);
		const providerConfig = configs.find((c) => c.type === provider);

		if (!providerConfig) {
			throw new Error(`AI provider ${provider} is not configured`);
		}

		const registry = createAIProviderRegistry(configs, aiSettings);
		const languageModel = registry.languageModel(`${provider}:${model}`);

		const result = await streamText({
			model: languageModel,
			prompt,
			temperature,
			maxTokens,
		});

		return result.text;
	}

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

			const aiSettings = await getAISettings();

			const hasAnyProvider =
				aiSettings.openaiApiKey ||
				aiSettings.anthropicApiKey ||
				aiSettings.googleApiKey ||
				(aiSettings.openaiCompatibleApiKey && aiSettings.openaiCompatibleBaseUrl);

			if (!hasAnyProvider) {
				logger.warn('No AI providers configured in Directus settings. Skipping AI generation.');
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
						aiSettings,
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
