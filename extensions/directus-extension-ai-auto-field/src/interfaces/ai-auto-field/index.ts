import { defineInterface } from '@directus/extensions-sdk';
import InterfaceAIAutoField from './interface.vue';

export default defineInterface({
	id: 'ai-auto-field',
	name: 'AI Auto Field',
	icon: 'smart_toy',
	description: 'Automatically generate field content using AI based on a template',
	component: InterfaceAIAutoField,
	types: ['string', 'text'],
	group: 'standard',
	options: ({ field }) => {
		return {
			standard: [
				{
					field: 'placeholder',
					name: 'Placeholder',
					type: 'string',
					meta: {
						width: 'full',
						interface: 'system-input-translated-string',
						options: {
							placeholder: 'Enter a placeholder...',
						},
					},
				},
			],
			advanced: [
				{
					field: 'promptTemplate',
					name: 'Prompt Template',
					type: 'text',
					meta: {
						width: 'full',
						interface: 'input-multiline',
						options: {
							placeholder: 'Write a blog post about: {{title}}',
						},
					},
					schema: {
						comment: 'Use {{field_name}} syntax to reference other fields in the same item',
					},
				},
				{
					field: 'aiProvider',
					name: 'AI Provider',
					type: 'string',
					meta: {
						width: 'half',
						interface: 'select-dropdown',
						options: {
							choices: [
								{ text: 'OpenAI', value: 'openai' },
								{ text: 'Anthropic', value: 'anthropic' },
								{ text: 'Google', value: 'google' },
								{ text: 'OpenAI Compatible', value: 'openai-compatible' },
							],
						},
					},
					schema: {
						default_value: 'openai',
					},
				},
				{
					field: 'aiModel',
					name: 'AI Model',
					type: 'string',
					meta: {
						width: 'half',
						interface: 'input',
						options: {
							placeholder: 'gpt-4o-mini',
						},
					},
					schema: {
						default_value: 'gpt-4o-mini',
					},
				},
				{
					field: 'temperature',
					name: 'Temperature',
					type: 'float',
					meta: {
						width: 'half',
						interface: 'slider',
						options: {
							min: 0,
							max: 2,
							step: 0.1,
						},
					},
					schema: {
						default_value: 0.7,
					},
				},
				{
					field: 'maxTokens',
					name: 'Max Tokens',
					type: 'integer',
					meta: {
						width: 'half',
						interface: 'input',
						options: {
							placeholder: '1000',
							min: 1,
						},
					},
					schema: {
						default_value: 1000,
					},
				},
				{
					field: 'triggerOnCreate',
					name: 'Trigger on Create',
					type: 'boolean',
					meta: {
						width: 'half',
						interface: 'boolean',
						options: {
							label: 'Automatically generate when item is created',
						},
					},
					schema: {
						default_value: true,
					},
				},
				{
					field: 'triggerOnUpdate',
					name: 'Trigger on Update',
					type: 'boolean',
					meta: {
						width: 'half',
						interface: 'boolean',
						options: {
							label: 'Automatically generate when item is updated',
						},
					},
					schema: {
						default_value: false,
					},
				},
				{
					field: 'regenerateIfEmpty',
					name: 'Regenerate if Empty',
					type: 'boolean',
					meta: {
						width: 'half',
						interface: 'boolean',
						options: {
							label: 'Only generate if field is empty',
						},
					},
					schema: {
						default_value: true,
					},
				},
				{
					field: 'allowManualRegeneration',
					name: 'Allow Manual Regeneration',
					type: 'boolean',
					meta: {
						width: 'half',
						interface: 'boolean',
						options: {
							label: 'Show regenerate button in the interface',
						},
					},
					schema: {
						default_value: true,
					},
				},
			],
		};
	},
});
