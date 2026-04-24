<template>
	<div class="ai-auto-field-interface">
		<div class="ai-auto-field-header">
			<span class="ai-auto-field-label">
				<v-icon name="smart_toy" small />
				AI Generated Content
			</span>
			<v-button
				v-if="allowManualRegeneration"
				icon
				x-small
				secondary
				:loading="isGenerating"
				@click="handleRegenerate"
			>
				<v-icon name="refresh" />
			</v-button>
		</div>
		<v-input
			:value="displayValue"
			:placeholder="placeholder"
			:disabled="isGenerating"
			multiline
			@input="handleInput"
		/>
		<div v-if="isGenerating" class="ai-auto-field-loading">
			<v-progress-linear indeterminate />
			<span>Generating with AI...</span>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';

interface Props {
	value: string | null;
	placeholder?: string;
	allowManualRegeneration?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	value: null,
	placeholder: '',
	allowManualRegeneration: true,
});

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
	(e: 'regenerate'): void;
}>();

const isGenerating = ref(false);

const displayValue = computed(() => props.value ?? '');

function handleInput(value: string) {
	emit('input', value || null);
}

async function handleRegenerate() {
	isGenerating.value = true;
	emit('regenerate');
}
</script>

<style scoped>
.ai-auto-field-interface {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.ai-auto-field-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.ai-auto-field-label {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	color: var(--foreground-subdued);
}

.ai-auto-field-loading {
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 12px;
	color: var(--foreground-subdued);
}
</style>
