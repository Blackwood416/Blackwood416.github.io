#!/usr/bin/env node

/**
 * process-aten-matrix.mjs
 * Processes E:\astro-blogs\public\assets\hardware_matrix.csv into structured
 * and highly compressed JSON matrix files for frontend fetch.
 * 
 * Auto-detects active PyTorch version by running PyTorch reflection.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const csvPath = path.resolve('pytorch-raw/hardware_matrix.csv');
const outputDir = path.resolve('public/data/pytorch');
const versionsPath = path.resolve('public/data/pytorch/versions.json');

// Auto-detect PyTorch version in active shell
function detectTorchVersion() {
	try {
		console.log('Detecting local PyTorch version via Python...');
		const output = execSync('python -c "import torch; print(torch.__version__)"', { encoding: 'utf-8' });
		const version = output.trim();
		if (version) {
			console.log('Detected PyTorch version:', version);
			return version;
		}
	} catch (e) {
		console.warn('Failed to detect PyTorch version via Python. Falling back to default version (v2.11.0-xpu).', e.message);
	}
	return '2.11.0+xpu';
}

function processMatrix() {
	if (!fs.existsSync(csvPath)) {
		console.error(`Error: Source CSV not found at: ${csvPath}`);
		process.exit(1);
	}

	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const rawVersion = detectTorchVersion();
	// Normalize filename (replace characters like '+' with '-' for safe file naming)
	const safeVersionName = 'v' + rawVersion.replace(/\+/g, '-');

	console.log(`Processing ATen hardware matrix to generate dataset for: ${rawVersion}`);

	const content = fs.readFileSync(csvPath, 'utf-8');
	const lines = content.split('\n');

	if (lines.length === 0) {
		console.error('Error: Source CSV file is empty.');
		process.exit(1);
	}

	// Parsing CSV header
	const header = lines[0].trim().split(',');
	const opIdx = header.indexOf('op_name');
	const keyIdx = header.indexOf('dispatch_key');
	const statusIdx = header.indexOf('status');

	if (opIdx === -1 || keyIdx === -1 || statusIdx === -1) {
		console.error('Error: Required headers (op_name, dispatch_key, status) missing in CSV.');
		process.exit(1);
	}

	const opsMap = new Map();

	// Process lines
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Robust CSV line parser supporting double quotes inside fields
		const row = [];
		let current = '';
		let inQuotes = false;
		for (let j = 0; j < line.length; j++) {
			const char = line[j];
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				row.push(current);
				current = '';
			} else {
				current += char;
			}
		}
		row.push(current);

		const opName = row[opIdx];
		const key = row[keyIdx];
		const status = row[statusIdx];

		if (!opName || !key) continue;

		if (!opsMap.has(opName)) {
			opsMap.set(opName, {
				op: opName,
				keys: {}
			});
		}

		const opData = opsMap.get(opName);
		// Normalize status values to conserve JSON file size
		// native -> n, composite -> c, fallback -> f, other -> o
		let shortStatus = 'o';
		if (status === 'native') shortStatus = 'n';
		else if (status === 'composite') shortStatus = 'c';
		else if (status === 'fallback') shortStatus = 'f';

		opData.keys[key] = shortStatus;
	}

	// Prepare data structure
	const records = [];
	for (const [opName, data] of opsMap.entries()) {
		records.push({
			o: data.op, // Shortened keys to save traffic
			k: data.keys
		});
	}

	// Output json file
	const outputFilePath = path.join(outputDir, `${safeVersionName}.json`);
	fs.writeFileSync(outputFilePath, JSON.stringify(records), 'utf-8');
	console.log(`Successfully generated operator matrix dataset (${records.length} ops) at:`, outputFilePath);

	// Update versions.json directory mapping
	let versionsMapping = {};
	if (fs.existsSync(versionsPath)) {
		try {
			versionsMapping = JSON.parse(fs.readFileSync(versionsPath, 'utf-8'));
		} catch (e) {
			versionsMapping = {};
		}
	}

	// We save a mapping: { "v2.11.0-xpu": "2.11.0+xpu" } to represent nicely formatted version titles
	versionsMapping[safeVersionName] = rawVersion;

	fs.writeFileSync(versionsPath, JSON.stringify(versionsMapping, null, 2), 'utf-8');
	console.log('Successfully updated version list mapping at:', versionsPath);
}

processMatrix();
