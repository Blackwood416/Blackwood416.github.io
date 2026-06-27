import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import readline from 'readline';

// 获取当前的本地 YYYY-MM-DD 日期
function getLocalDateString() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

// 格式化文件名，过滤掉 Windows/Linux 文件名中的非法字符，并将空格和下划线替换为短横线
function cleanFilename(name) {
	return name
		.trim()
		.toLowerCase()
		.replace(/[\\/:*?"<>|]+/g, '') // 移除非法字符
		.replace(/[\s_]+/g, '-')       // 空格和下划线转短横线
		.replace(/-+/g, '-')           // 连续短横线合并
		.replace(/^-+|-+$/g, '');      // 去除首尾短横线
}

// 创建文章主逻辑
function createPost(title, slugInput) {
	const dateStr = getLocalDateString();
	
	// 确定文件名 slug
	let slug = cleanFilename(slugInput || title);
	if (!slug) {
		slug = 'untitled-post';
	}
	
	const filename = `${dateStr}-${slug}.md`;
	const blogDir = path.resolve('src/content/blog');
	const filePath = path.join(blogDir, filename);

	// 检查目录是否存在
	if (!fs.existsSync(blogDir)) {
		fs.mkdirSync(blogDir, { recursive: true });
	}

	// 检查文件是否已存在
	if (fs.existsSync(filePath)) {
		console.error(`\x1b[31m错误: 文章文件已存在! -> ${filePath}\x1b[0m`);
		process.exit(1);
	}

	// 生成文章内容模板
	const template = `---
title: "${title.replace(/"/g, '\\"')}"
description: "这里是关于 ${title.replace(/"/g, '\\"')} 的简短描述..."
pubDate: ${dateStr}
categories: []
tags: []
draft: true
---

# ${title}

在此处开始撰写您的文章...
`;

	try {
		fs.writeFileSync(filePath, template, 'utf-8');
		console.log(`\x1b[32m成功: 文章创建成功!\x1b[0m`);
		console.log(`\x1b[34m路径: ${filePath}\x1b[0m`);

		// 自动在 VS Code 中打开该文件
		const relativePath = path.relative(path.resolve(), filePath);
		exec(`code "${relativePath}"`, (err) => {
			if (err) {
				console.log(`\x1b[33m提示: 已为您生成模板文件。您可以使用 VS Code 手动打开并编辑: ${relativePath}\x1b[0m`);
			} else {
				console.log(`\x1b[32m已自动在 VS Code 中打开该文件进行编辑! 🚀\x1b[0m`);
			}
			process.exit(0);
		});
	} catch (error) {
		console.error(`\x1b[31m写入文件时出错:\x1b[0m`, error);
		process.exit(1);
	}
}

// 支持命令行传参或交互式问答
async function main() {
	const args = process.argv.slice(2);
	
	// 1. 如果直接传入了参数
	if (args.length > 0) {
		const title = args[0];
		const slugInput = args[1] || '';
		createPost(title, slugInput);
		return;
	}

	// 2. 否则进入交互式询问
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	const question = (query) => new Promise((resolve) => rl.question(query, resolve));

	try {
		console.log('\x1b[35m=== 创建新 Astro 博客文章 ===\x1b[0m');
		const titleInput = await question('\x1b[36m请输入文章标题: \x1b[0m');
		
		if (!titleInput.trim()) {
			console.error('\x1b[31m标题不能为空!\x1b[0m');
			rl.close();
			process.exit(1);
		}

		const slugInput = await question('\x1b[36m请输入文件名 slug (可选，直接回车将使用标题作为文件名): \x1b[0m');
		
		rl.close();
		createPost(titleInput.trim(), slugInput.trim());
	} catch (err) {
		console.error('\x1b[31m发生错误:\x1b[0m', err);
		rl.close();
		process.exit(1);
	}
}

main();
