export function parseTemplate(template: string, data: Record<string, unknown>): string {
	const regex = /\{\{([^}]+)\}\}/g;

	return template.replace(regex, (match, fieldPath) => {
		const path = fieldPath.trim();
		const value = getValueByPath(data, path);

		if (value === undefined || value === null) {
			return '';
		}

		return String(value);
	});
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
	const keys = path.split('.');
	let current: unknown = obj;

	for (const key of keys) {
		if (current === null || current === undefined) {
			return undefined;
		}

		if (typeof current !== 'object') {
			return undefined;
		}

		current = (current as Record<string, unknown>)[key];
	}

	return current;
}
