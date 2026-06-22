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

function readCodeText(codeNode: HastNode): string {
	if (codeNode.type === 'text') {
		return codeNode.value ?? '';
	}

	return (codeNode.children ?? []).map((child) => readCodeText(child)).join('');
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
	const rawMeta = String(
		codeNode.properties?.['data-code-block-meta'] ??
			preNode.properties?.['data-code-block-meta'] ??
			codeNode.data?.meta ??
			language ??
			'',
	);
	const meta = parseCodeFenceMeta(rawMeta);
	const label = meta.title ?? meta.language ?? language ?? 'code';
	const codeText = readCodeText(codeNode);

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
