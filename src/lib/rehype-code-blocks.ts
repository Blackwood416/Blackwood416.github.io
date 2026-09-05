import { parseCodeFenceMeta } from './blog.ts';

type HastNode = {
	type?: string;
	tagName?: string;
	value?: string;
	properties?: Record<string, unknown>;
	data?: Record<string, unknown>;
	children?: HastNode[];
};

const textNode = (value: string): HastNode => ({ type: 'text', value });

function isElement(node: HastNode | undefined, tagName?: string): node is HastNode {
	return Boolean(node && node.type === 'element' && (!tagName || node.tagName === tagName));
}

function readCodeText(node: HastNode): string {
	if (node.type === 'text') {
		return node.value ?? '';
	}
	if (!node.children || node.children.length === 0) {
		return '';
	}

	const hasLines = node.children.some(
		(child) =>
			isElement(child) &&
			Array.isArray(child.properties?.className) &&
			child.properties.className.includes('line'),
	);

	if (hasLines) {
		return node.children.map((child) => readCodeText(child)).join('\n');
	}

	return node.children.map((child) => readCodeText(child)).join('');
}

function isMermaidCode(codeText: string, language: string | null): boolean {
	if (language === 'mermaid') return true;
	const trimmed = codeText.replace(/^\uFEFF/, '').trim();
	return /^(?:graph\b|flowchart\b|sequenceDiagram\b|classDiagram\b|stateDiagram(?:-v2)?\b|erDiagram\b|journey\b|gantt\b|pie\b|quadrantChart\b|requirementDiagram\b|gitGraph\b|mindmap\b|timeline\b|zenuml\b|sankey\b|block\b)/i.test(trimmed);
}

function createCodeFigure(preNode: HastNode): HastNode | null {
	const codeNode = preNode.children?.find((child) => isElement(child, 'code'));

	if (!codeNode) {
		return null;
	}

	const className = codeNode.properties?.className ?? [];
	const languageClass = Array.isArray(className)
		? className.find((name) => String(name).startsWith('language-'))
		: null;
	const language = languageClass ? String(languageClass).replace('language-', '') : null;
	if (language === 'math' || language === 'katex') {
		return null;
	}

	const codeText = readCodeText(codeNode);
	if (isMermaidCode(codeText, language)) {
		return {
			type: 'element',
			tagName: 'div',
			properties: {
				className: ['mermaid-wrapper'],
			},
			children: [
				{
					type: 'element',
					tagName: 'pre',
					properties: {
						className: ['mermaid'],
					},
					children: [textNode(codeText.trim())],
				},
			],
		};
	}
	const rawMeta = String(
		codeNode.properties?.['data-code-block-meta'] ??
			preNode.properties?.['data-code-block-meta'] ??
			codeNode.data?.meta ??
			language ??
			'',
	);
	const meta = parseCodeFenceMeta(rawMeta);
	const label = meta.title ?? meta.language ?? language ?? 'code';

	return {
		type: 'element',
		tagName: 'figure',
		properties: {
			className: ['code-block'],
			'data-language': meta.language ?? language ?? 'code',
		},
		children: [
			{
				type: 'element',
				tagName: 'figcaption',
				properties: { className: ['code-block__header'] },
				children: [
					{
						type: 'element',
						tagName: 'span',
						properties: { className: ['code-block__label'] },
						children: [textNode(label)],
					},
					{
						type: 'element',
						tagName: 'button',
						properties: {
							type: 'button',
							className: ['code-block__copy'],
							'data-code-copy': '',
							'data-code-text': codeText,
							'aria-label': `复制 ${label} 代码`,
						},
						children: [textNode('复制')],
					},
				],
			},
			{
				type: 'element',
				tagName: 'pre',
				properties: { className: ['code-block__pre'] },
				children: [codeNode],
			},
		],
	};
}

function transformChildren(node: HastNode): void {
	if (!Array.isArray(node.children)) {
		return;
	}

	node.children = node.children.map((child) => {
		if (isElement(child, 'pre')) {
			return createCodeFigure(child) ?? child;
		}

		transformChildren(child);
		return child;
	});
}

export default function rehypeCodeBlocks() {
	return (tree: HastNode) => {
		transformChildren(tree);
	};
}
