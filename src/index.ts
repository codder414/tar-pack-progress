import { Command, flags } from '@oclif/command';
import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as tarFs from 'tar-fs';
import * as micromatch from 'micromatch';
import * as cli from 'cli-progress';
import * as chalk from 'chalk';

import { convertBytesToHuman, calculateCompressRatio } from './utils';
import { pipeline, Transform } from 'stream';

// '[{bar}] {percentage}% | {value}/{total} | Files: {files} | ETA: {estimated} | File: {file}'

const sleep = (ms: number): Promise<NodeJS.Timeout> =>
	new Promise((resolve) => {
		const t = setTimeout(() => {
			resolve(t);
		}, ms);
	});
const createInterval = (fn: (...args: unknown[]) => unknown, ms: number) => {
	let state = true;
	return {
		run: async () => {
			while (state) {
				await sleep(ms);
				await fn();
			}
		},
		stop: () => {
			state = false;
		}
	};
};

async function getTotalFilesCount(
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
			totalSize += (await fs.promises.stat(fullPath)).size;
			totalNumberOfFiles++;
		}
	}

	return { totalSize, filesNum: totalNumberOfFiles };
}

const createConvertToHumanFn = (enableRawBytes: boolean) => (...args: Parameters<typeof convertBytesToHuman>) =>
	enableRawBytes ? `${args[0]}` : convertBytesToHuman(...args);

const toHHMMSS = (secs: number) => {
	var hours = Math.floor(secs / 3600);
	var minutes = Math.floor(secs / 60) % 60;
	var seconds = secs % 60;

	return [hours, minutes, seconds]
		.map((v) => (v < 10 ? '0' + v : v))
		.filter((v, i) => v !== '00' || i > 0)
		.join(':');
};

enum LogLevel {
	Silent = 0,
	Common = 1 << 0,
	Verbose = 1 << 1
}
type LogLevelStr = keyof typeof LogLevel;

class Logger {
	private logLevel: number;
	private externalLogger: ProjectsBackuper;
	constructor(logLevel: LogLevel, externalLogger: ProjectsBackuper) {
		this.logLevel = logLevel;
		this.externalLogger = externalLogger;
	}

	info(message?: string | undefined, entries?: any[]): void {
		if (this.logLevel > LogLevel.Silent) {
			if (entries) {
				this.externalLogger.log(message, entries);
			} else {
				this.externalLogger.log(message);
			}
		}
	}

	verbose(message: string, entries?: []): void {
		if (this.logLevel > LogLevel.Common) {
			if (entries) {
				this.externalLogger.log(message, entries);
			} else {
				this.externalLogger.log(message);
			}
		}
	}
}

function getLogLevel(silent: boolean, verbose: boolean): LogLevel {
	if (silent) {
		return LogLevel.Silent;
	} else if (verbose) {
		return LogLevel.Verbose;
	} else {
		return LogLevel.Common;
	}
}

class ProjectsBackuper extends Command {
	static description = 'Backup dir with progress and ignore syntax';

	static flags = {
		version: flags.version(),
		verbose: flags.boolean({
			char: 'v',
			description: 'verbose',
			default: false
		}),
		silent: flags.boolean({
			description: 'do not output info to stdout',
			default: false
		}),
		help: flags.help(),
		from: flags.string({
			description: 'source dir, wich used to archive',
			required: true
		}),
		to: flags.string({
			description: 'destination archive path',
			required: true
		}),
		exclude: flags.string({
			description: `skip files or dirs that should not be packed
				see https://www.npmjs.com/package/micromatch for pattern details`,
			multiple: true
		}),
		gzip: flags.boolean({
			description: 'enable gzip compression',
			default: false
		}),
		rawBytes: flags.boolean({
			description: 'show sizes as bytes',
			default: false,
			char: 'r'
		})
	};

	static args = [];

	async run() {
		const { flags } = this.parse(ProjectsBackuper);

		const enableGzip = flags.gzip;
		const from = path.resolve(flags.from);
		const targetDirName = path.basename(from);
		const archiveName = path.basename(flags.to);
		const archiveDir = path.dirname(flags.to);
		const archivePath = path.resolve(path.join(archiveDir, archiveName));
		const excludedEntries = flags.exclude ?? [];
		const verbose = flags.verbose;
		const silent = flags.silent;
		const enableRawBytes = flags.rawBytes;

		const circleBuffer = new CirleBuffer(1000);

		const convertToHuman = createConvertToHumanFn(enableRawBytes);

		const isTTY = process.stdout.isTTY;

		const logger = new Logger(getLogLevel(silent, verbose), this);

		const formatter: cli.GenericFormatter = (options, params, payload): string => {
			const bar = cli.Format.BarFormat(params.progress, options);
			const percentage = Math.round((params.value / params.total) * 100);
			const value = convertToHuman(+cli.Format.ValueFormat(params.value, options, 'value'));
			const total = convertToHuman(params.total);
			const files = payload.files;
			const ETA = payload.estimated;
			const file = payload.file;
			return `[${bar}] ${percentage}% | ${value}/${total} | Files: ${files} | ETA: ${ETA} | File: ${file}`;
		};

		const error = await checkDirPath(path.resolve(archiveDir));
		if (error) {
			this.error(error);
		}

		if (isTTY) {
			logger.info(`${chalk.bold('From')}: ${chalk.dim(from)}`);
			logger.info(`${chalk.bold('To')}: ${chalk.dim(archivePath)}`);
			logger.info(`${chalk.bold('Gzip')}: ${enableGzip ? chalk.green('true') : chalk.red('false')}`);
			logger.info(`${chalk.bold('Exclude')}: `, excludedEntries);
		}

		let { filesNum, totalSize } = await getTotalFilesCount(from, (mpath) => {
			return excludedEntries.some((pattern) => micromatch.isMatch(mpath, pattern));
		});

		let totalFilesNum = filesNum;
		totalFilesNum++;
		const progressBar = new ProgressBarTTY(totalFilesNum, totalSize, formatter);
		let totalBytes: number = 0;
		let totalCompressedBytes: number = 0;

		const normalizedPath = archivePath;
		if (!hasExtension(normalizedPath)) {
			this.error(" --to should contain extension: 'tar' 'gz' etc in a path");
		}
		let totalF = 0;
		let currentFile = 'N/A';
		const tarOptions: tarFs.PackOptions = {
			map: (header) => {
				totalF++;
				header.name = `${targetDirName}${path.sep}${header.name}`;
				currentFile = header.name;
				if (!isTTY) {
					// this.log(`${header.name} ${header.size}`);
				}
				return header;
			}
		};

		if (excludedEntries && excludedEntries.length > 0) {
			tarOptions.ignore = (mpath) => {
				return excludedEntries.some((pattern) => micromatch.isMatch(mpath, pattern));
			};
		}

		const archive = tarFs.pack(from, tarOptions);
		let bytesPerSec = 0;
		let bytesPerSecPrev = 0;
		let isFirst = true;
		let times = new CirleBuffer(10);

		const interval = createInterval(() => {
			if (isFirst) {
				bytesPerSecPrev = totalBytes;
				isFirst = false;
			}

			bytesPerSec = totalBytes - bytesPerSecPrev;
			circleBuffer.push(bytesPerSec);
			times.push(circleBuffer.avg());
			// logger.verbose(`Bytes per sec: ${convertToHuman(times.avg(), 3)}`);
			let size = totalSize - totalBytes;
			size = size > 0 ? size : 1;
			progressBar.update({
				estimated: toHHMMSS(Math.round(size / times.avg()))
			} as any);
			bytesPerSecPrev = totalBytes;
		}, 1000);

		interval.run();

		const reportProgressTransform = createTransform((chunk) => {
			totalBytes += chunk.length;
			progressBar.update(totalBytes, {
				file: currentFile,
				files: `${totalF}/${totalFilesNum}`
			});
		});

		const countCompressedBytes = createTransform((chunk) => {
			totalCompressedBytes += chunk.length;
		});

		const output = fs.createWriteStream(normalizedPath);
		if (enableGzip) {
			pipeline(archive, reportProgressTransform, zlib.createGzip(), countCompressedBytes, output, (err) => {
				if (err) {
					this.error(err);
				}
			}).on('close', () => {
				if (isTTY) {
					logger.verbose(`${chalk.bold('Uncompressed size')}: ${convertToHuman(totalBytes, 2)}`);
					logger.verbose(
						`${chalk.bold('Compression ratio')}: ${calculateCompressRatio(
							totalBytes,
							totalCompressedBytes
						)}%`
					);
					logger.info(`Total size: ${chalk.bold(convertToHuman(totalCompressedBytes, 2))}`);
				}
				interval.stop();
			});
		} else {
			pipeline(archive, reportProgressTransform, output, (err) => {
				if (err) {
					this.error(err);
				}
			}).on('close', () => {
				if (isTTY) {
					logger.info(`Total size: ${chalk.bold(convertToHuman(totalBytes, 2))}`);
				}
				interval.stop();
			});
		}
	}
}

function hasExtension(destPath: string): boolean {
	const parts = destPath.split('/');
	return parts[parts.length - 1].split('.').length > 1;
}

async function checkDirPath(dirPath: string): Promise<undefined | Error> {
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

class ProgressBarTTY {
	public cli: cli.SingleBar | undefined;
	constructor(totalFilesNum: number, totalSize: number, formatter: cli.GenericFormatter) {
		if (process.stdout.isTTY) {
			this.cli = new cli.SingleBar({
				fps: 20,
				stopOnComplete: true,
				// format: '[{bar}] {percentage}% | {value}/{total} | Files: {files} | ETA: {estimated} | File: {file}',
				format: formatter,
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591',
				clearOnComplete: true
			});
			this.cli.start(totalSize, 0, { files: `0/${totalFilesNum}`, file: 'N/A', estimated: 'N/A' });
		}
	}

	public update(current: number | null, payload?: object | undefined) {
		if (process.stdout.isTTY && this.cli) {
			this.cli.update(current as number, payload);
		}
	}

	public updateETA() {
		if (process.stdout.isTTY && this.cli) {
			this.cli.updateETA();
		}
	}
}

export = ProjectsBackuper;

class CirleBuffer {
	data: number[] = [];
	private size: number;
	constructor(size: number) {
		this.size = size;
	}
	public push(item: number): void {
		this.data.push(item);
		if (this.data.length > this.size) {
			this.data = this.data.slice(1);
			return;
		}
	}

	public avg(): number {
		return this.data.reduce((acc, num) => acc + num, 0) / this.data.length;
	}
}

function createTransform(cb: (chunk: any) => void) {
	return new Transform({
		transform(chunk, encoding, callback) {
			cb(chunk);
			callback(undefined, chunk);
		}
	});
}
