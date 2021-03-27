import { Command, flags } from '@oclif/command';
import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as tarFs from 'tar-fs';
import * as micromatch from 'micromatch';
import * as cli from 'cli-progress';
import * as chalk from 'chalk';

import { convertBytesToHuman, calculateCompressRatio } from './utils';

async function getTotalFilesCount(
	dirPath: string,
	shouldIgnore: (entryPath: string) => boolean = () => true,
	totalNumberOfFiles: number = 0
): Promise<number> {
	const files = await fs.promises.readdir(path.resolve(dirPath), { withFileTypes: true });
	for (const entry of files) {
		const fullPath = path.resolve(path.join(dirPath, entry.name));
		if (shouldIgnore(fullPath)) {
			continue;
		}
		if (entry.isDirectory()) {
			totalNumberOfFiles++;
			totalNumberOfFiles = await getTotalFilesCount(fullPath, shouldIgnore, totalNumberOfFiles);
		} else {
			totalNumberOfFiles++;
		}
	}

	return totalNumberOfFiles;
}

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

		const convertToHuman = (...args: Parameters<typeof convertBytesToHuman>) =>
			enableRawBytes ? `${args[0]}` : convertBytesToHuman(...args);

		const isTTY = process.stdout.isTTY;

		const logger = new Logger(getLogLevel(silent, verbose), this);

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

		let totalFilesNum: number = await getTotalFilesCount(from, (mpath) => {
			return excludedEntries.some((pattern) => micromatch.isMatch(mpath, pattern));
		});

		totalFilesNum++;

		const progressBar = new ProgressBarTTY(totalFilesNum);
		let totalBytes: number = 0;
		let totalCompressedBytes: number = 0;

		const normalizedPath = archivePath;
		if (!hasExtension(normalizedPath)) {
			this.error(" --to should contain extension: 'tar' 'gz' etc in a path");
		}
		let totalF = 0;
		const tarOptions: tarFs.PackOptions = {
			map: (header) => {
				header.name = `${targetDirName}${path.sep}${header.name}`;
				progressBar.update(++totalF, { size: `${convertToHuman(totalBytes)}`, file: header.name });
				if (!isTTY) {
					this.log(`${header.name} ${header.size}`);
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

		archive.on('data', (chunk: any) => {
			totalBytes += chunk.length;
		});
		const output = fs.createWriteStream(normalizedPath);
		if (enableGzip) {
			const gzipStream = archive.pipe(zlib.createGzip());
			gzipStream.on('data', (chunk) => {
				totalCompressedBytes += chunk.length;
			});
			gzipStream.pipe(output).on('close', () => {
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
			});
		} else {
			archive.pipe(output).on('close', () => {
				if (isTTY) {
					logger.info(`Total size: ${chalk.bold(convertToHuman(totalBytes, 2))}`);
				}
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
	public cli: cli.SingleBar | { update: () => void };
	constructor(totalFilesNum: number) {
		if (process.stdout.isTTY) {
			this.cli = new cli.SingleBar({
				fps: 10,
				stopOnComplete: true,
				format: '[{bar}] {percentage}% | ETA: {eta}s | {value}/{total} | Size: {size} | File: {file}',
				barCompleteChar: '\u2588',
				barIncompleteChar: '\u2591',
				clearOnComplete: true
			});
			this.cli.start(totalFilesNum, 0, { size: 'N/A' });
		} else {
			this.cli = { update: (...args) => undefined };
		}
	}

	public update(current: number, payload?: object | undefined) {
		if (process.stdout.isTTY) {
			this.cli.update(current, payload);
		}
	}
}

export = ProjectsBackuper;
