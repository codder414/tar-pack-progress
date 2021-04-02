import * as fs from 'fs';
import * as path from 'path';
import { Transform } from 'stream';

export function convertBytesToHuman(
	bytes: number,
	precision: number = 2,
	type?: 'b' | 'kb' | 'mb' | 'gb' | 'zb' | 'pb'
): string {
	if (bytes < 1024) {
		return `${bytes} b`;
	}
	let remain: [number, string] = [bytes, 'b'];
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

export function calculateCompressRatio(uncompressedSize: number, compressedSize: number): number {
	return Math.round((((uncompressedSize - compressedSize) * 100) / uncompressedSize + Number.EPSILON) * 100) / 100;
}

export function isFileTypeSupported(type: string): boolean {
	const SUPPORTED_FILE_TYPES = ['file', 'link', 'directory', 'symlink'];

	return SUPPORTED_FILE_TYPES.includes(type);
}

export const statPath = (() => {
	const cache: Map<string, fs.Stats> = new Map();
	return (p: string) => {
		if (cache.has(p)) {
			return cache.get(p) as fs.Stats;
		}
		const stat = fs.statSync(p);
		cache.set(p, stat);
		return stat;
	};
})();

export async function getTotalFilesCount(
	dirPath: string,
	shouldIgnore: (entryPath: string) => boolean = () => true,
	totalNumberOfFiles: number = 0,
	totalSize: number = 0
): Promise<{ filesNum: number; totalSize: number }> {
	const files = await fs.promises.readdir(path.resolve(dirPath), { withFileTypes: true });
	for (const entry of files) {
		const fullPath = path.resolve(path.join(dirPath, entry.name));
		if (shouldIgnore(fullPath)) {
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
				const stats = await statPath(fullPath);
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

export const createConvertToHumanFn = (enableRawBytes: boolean) => (...args: Parameters<typeof convertBytesToHuman>) =>
	enableRawBytes ? `${args[0]}` : convertBytesToHuman(...args);

export const toHHMMSS = (secs: number) => {
	var hours = Math.floor(secs / 3600);
	var minutes = Math.floor(secs / 60) % 60;
	var seconds = secs % 60;

	return [hours, minutes, seconds]
		.map((v) => (v < 10 ? '0' + v : v))
		.filter((v, i) => v !== '00' || i > 0)
		.join(':');
};

export function hasExtension(destPath: string): boolean {
	const parts = destPath.split('/');
	return parts[parts.length - 1].split('.').length > 1;
}

export async function checkDirPath(dirPath: string): Promise<undefined | Error> {
	try {
		const stats = await fs.promises.stat(path.resolve(dirPath));
		if (!stats.isDirectory()) {
			return new Error(`given path is not directory: '${dirPath}'`);
		}
	} catch (err) {
		if (err.code === 'ENOENT') {
			return new Error(`no such directory '${dirPath}'`);
		}
		return err;
	}
}

export function createTransform(cb: (chunk: any) => void) {
	return new Transform({
		transform(chunk, encoding, callback) {
			cb(chunk);
			callback(undefined, chunk);
		}
	});
}
