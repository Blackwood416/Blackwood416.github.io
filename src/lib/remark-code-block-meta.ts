type MarkdownNode = {
	type?: string;
	lang?: string;
	meta?: string;
	value?: string;
	data?: {
		hProperties?: Record<string, string>;
	};
	children?: MarkdownNode[];
};

function attachCodeMeta(node: MarkdownNode): void {
	node.data = node.data ?? {};
	node.data.hProperties = {
		...node.data.hProperties,
		'data-code-block-meta': [node.lang, node.meta].filter(Boolean).join(' '),
	};
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function transformChildren(node: MarkdownNode): void {
	if (!Array.isArray(node.children)) {
		return;
	}

	const children: MarkdownNode[] = [];

	for (const child of node.children) {
		if (child.type === 'code') {
			if (child.lang === 'mermaid') {
				children.push({
					type: 'html',
					value: `<div class="mermaid-wrapper"><pre class="mermaid">${escapeHtml(child.value ?? '')}</pre></div>`,
				});
				continue;
			}
			attachCodeMeta(child);
			children.push(child);
			continue;
		}

		transformChildren(child);
		children.push(child);
	}

	node.children = children;
}

export default function remarkCodeBlockMeta() {
	return (tree: MarkdownNode) => {
		transformChildren(tree);
	};
}
