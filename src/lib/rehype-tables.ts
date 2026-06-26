type HastNode = {
	type?: string;
	tagName?: string;
	value?: string;
	properties?: Record<string, unknown>;
	data?: Record<string, unknown>;
	children?: HastNode[];
};

function isElement(node: HastNode | undefined, tagName?: string): node is HastNode {
	return Boolean(node && node.type === 'element' && (!tagName || node.tagName === tagName));
}

function transformChildren(node: HastNode): void {
	if (!Array.isArray(node.children)) {
		return;
	}

	node.children = node.children.map((child) => {
		if (isElement(child, 'table')) {
			// 将 table 节点包裹在 div.table-wrapper 中
			return {
				type: 'element',
				tagName: 'div',
				properties: { className: ['table-wrapper'] },
				children: [child],
			};
		}

		transformChildren(child);
		return child;
	});
}

export default function rehypeTables() {
	return (tree: HastNode) => {
		transformChildren(tree);
	};
}
