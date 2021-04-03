const fs = require('fs');
const path = require('path');

function getPath(basePath, dirName) {
	return path.resolve(path.join(basePath, dirName));
}

function convertBytesToHuman(bytes, precision = 2, type) {
	if (bytes < 1024) {
		return `${bytes} b`;
	}
	let remain = [bytes, 'b'];
	let counter = 0;
	let types = ['b', 'kb', 'mb', 'gb', 'zb', 'pb'];
	const hasType = !!type;
	while (remain[0] >= 1024 && counter < types.length) {
		remain = [remain[0] / 1024, types[++counter]];
		if (hasType && type == remain[1]) {
			break;
		}
	}
	const tmpNum = parseInt(`1${'0'.repeat(precision)}`);
	const result = Math.round((remain[0] + Number.EPSILON) * tmpNum) / tmpNum;
	return `${result.toFixed(precision)} ${remain[1]}`;
}

async function getTotalFilesCount(dirPath, shouldIgnore = (mpath) => true, totalNumberOfFiles = 0, totalSize = 0) {
	const files = await fs.promises.readdir(path.resolve(dirPath), { withFileTypes: true });
	for (const entry of files) {
		const fullPath = path.resolve(path.join(dirPath, entry.name));
		if (shouldIgnore(entry.name)) {
			continue;
		}
		if (entry.isDirectory()) {
			totalNumberOfFiles++;
			let { totalSize: s, filesNum: f } = await getTotalFilesCount(
				fullPath,
				shouldIgnore,
				totalNumberOfFiles,
				totalSize
			);
			totalNumberOfFiles = f;
			totalSize = s;
		} else {
			// omit dead symbolic links
			try {
				const stats = await fs.promises.stat(fullPath);
				if (stats.isFile() || stats.isSymbolicLink()) {
					totalSize += stats.size;
				}
			} catch (err) {
				if (err.code !== 'ENOENT') {
					throw err;
				}
			}
			totalNumberOfFiles++;
		}
	}

	return { totalSize, filesNum: totalNumberOfFiles };
}
(async () => {
	const data = await getTotalFilesCountPerf('/home', (mpath) => mpath === 'run');
	console.log(data);
	const d = process.memoryUsage();
	console.log('Heap Total: ' + convertBytesToHuman(d.heapTotal));
	console.log('Head Used: ' + convertBytesToHuman(d.heapUsed));
})();
