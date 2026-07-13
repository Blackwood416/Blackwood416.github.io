import fs from 'fs';
import path from 'path';

const srcDir = 'pytorch-raw/pytorch_aten_exports';
const destDir = 'public/data/pytorch';
const versionsPath = path.join(destDir, 'versions.json');

if (!fs.existsSync(destDir)) {
	fs.mkdirSync(destDir, { recursive: true });
}

// Automatically detect relevant hardware backends based on filename/version
function getActiveBackends(fileName) {
	const lower = fileName.toLowerCase();
	let targetBackend = 'CPU';
	if (lower.includes('xpu')) targetBackend = 'XPU';
	else if (lower.includes('cu')) targetBackend = 'CUDA';
	else if (lower.includes('rocm') || lower.includes('hip')) targetBackend = 'HIP';
	else if (lower.includes('xla')) targetBackend = 'XLA';
	else if (lower.includes('hpu')) targetBackend = 'HPU';
	
	const active = ['CPU'];
	if (targetBackend !== 'CPU') {
		active.push(targetBackend);
	}
	return active;
}

function syncAll() {
	if (!fs.existsSync(srcDir)) {
		console.error(`Source directory not found: ${srcDir}`);
		return;
	}

	const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json') && f !== 'versions.json');
	console.log(`Found ${files.length} version files to sync and compress...`);

	let versionsMapping = {};

	files.forEach(file => {
		const safeVersionName = file.replace('.json', '');
		const activeBackends = getActiveBackends(file);
		const rawVersion = safeVersionName.substring(1).replace('-', '+');

		const rawData = JSON.parse(fs.readFileSync(path.join(srcDir, file), 'utf-8'));
		
		let operators = [];
		let detectedRaw = rawVersion;
		if (Array.isArray(rawData)) {
			operators = rawData;
		} else if (rawData && Array.isArray(rawData.operators)) {
			operators = rawData.operators;
			detectedRaw = rawData.pytorch_version || rawVersion;
		}

		const compressedRecords = [];
		operators.forEach(op => {
			const opName = op.o || op.name;
			const opKernels = op.k || op.kernels;
			if (!opName || !opKernels) return;

			const keys = {};
			activeBackends.forEach(be => {
				const rawStatus = opKernels[be];
				let status = 'o';
				if (rawStatus === true || rawStatus === 'n' || rawStatus === 'native') status = 'n';
				else if (rawStatus === 'c' || rawStatus === 'composite') status = 'c';
				else if (rawStatus === 'f' || rawStatus === 'fallback') status = 'f';

				if (status !== 'o') {
					keys[be] = status;
				}
			});

			if (Object.keys(keys).length > 0) {
				compressedRecords.push({
					o: opName,
					k: keys
				});
			}
		});

		const destFilePath = path.join(destDir, file);
		fs.writeFileSync(destFilePath, JSON.stringify(compressedRecords), 'utf-8');
		console.log(`Synced & compressed: ${file} (Ops: ${compressedRecords.length}, Size: ${(fs.statSync(destFilePath).size / 1024).toFixed(1)} KB)`);

		versionsMapping[safeVersionName] = {
			raw: detectedRaw,
			backends: activeBackends
		};
	});

	// Sort versions in descending order so that latest versions appear first
	const sortedVersions = {};
	Object.keys(versionsMapping)
		.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))
		.forEach(key => {
			sortedVersions[key] = versionsMapping[key];
		});

	fs.writeFileSync(versionsPath, JSON.stringify(sortedVersions, null, 2), 'utf-8');
	console.log(`Successfully synced all versions to: ${versionsPath}`);
}

syncAll();
