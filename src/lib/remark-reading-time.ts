export default function remarkReadingTime() {
	return function (tree: any, { data }: any) {
		let text = '';
		
		function visit(node: any) {
			if (node.type === 'text') {
				text += node.value;
			}
			if (node.children) {
				node.children.forEach(visit);
			}
		}
		
		visit(tree);
		
		// 移除所有空白符以计算纯文字数量（包含中文汉字和英文单词字符）
		const cleanText = text.replace(/\s+/g, '');
		const wordCount = cleanText.length;
		
		// 估算阅读时间：中文通常按 350 字/分钟，英文通常按 200 词/分钟。这里用 350 字/分钟统一折算。
		const readingTime = Math.ceil(wordCount / 350);
		
		data.astro.frontmatter.wordCount = wordCount;
		data.astro.frontmatter.readingTime = readingTime;
	};
}
