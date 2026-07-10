import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('public/assets/gpu_ai_perf.db');
const outputPath = path.resolve('src/data/gpu_ai_perf.json');

try {
	// 确保输出目录存在
	const dir = path.dirname(outputPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	console.log('Exporting SQLite data from:', dbPath);
	const rawJson = execSync(`sqlite3 -json "${dbPath}" "SELECT * FROM gpu_ai_perf ORDER BY id ASC"`).toString();
	
	// 解析数据并修正精度漂移
	const data = JSON.parse(rawJson).map(item => {
		if (item.bandwidth_gbs !== null && item.bandwidth_gbs !== undefined) {
			item.bandwidth_gbs = Math.round(item.bandwidth_gbs * 100) / 100;
		}
		if (item.fp32_tflops !== null && item.fp32_tflops !== undefined) {
			item.fp32_tflops = Math.round(item.fp32_tflops * 1000) / 1000;
		}
		if (item.ai_core_perf !== null && item.ai_core_perf !== undefined) {
			item.ai_core_perf = Math.round(item.ai_core_perf * 100) / 100;
		}
		// 转换 vendor 为统一大写，防止数据录入不一致
		if (item.vendor) {
			item.vendor = item.vendor.trim().toUpperCase();
		}
		return item;
	});

	fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
	console.log(`Successfully generated GPU JSON data (${data.length} records) at:`, outputPath);
} catch (error) {
	console.error('Error exporting SQLite database:', error);
	process.exit(1);
}
