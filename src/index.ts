import { Command, flags } from '@oclif/command';
import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as tarFs from 'tar-fs';
import * as micromatch from 'micromatch';
import * as chalk from 'chalk';
import { ProgressBarTTY, createFormatter } from './progressBar';
import { Logger, LoggerOptions } from './logger';
import {
	calculateCompressRatio,
	createConvertToHumanFn,
	getTotalFilesCountPerf,
	checkDirPath,
	createTransform,
	hasExtension,
	statPath
} from './utils';
import { pipeline } from 'stream';
import * as tar from 'tar';
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

		const from = path.resolve(flags.from);
		const targetDirPath = path.dirname(from);
		const targetDirName = path.basename(from);
		const archiveName = path.basename(flags.to);
		const archiveDir = path.dirname(flags.to);
		const archivePath = path.resolve(path.join(archiveDir, archiveName));
		const excludedEntries = flags.exclude ?? [];

		// boolean flags
		const verbose = flags.verbose;
		const enableGzip = flags.gzip;
		const silent = flags.silent;
		const enableRawBytes = flags.rawBytes;
		const isTTY = process.stdout.isTTY;

		const convertToHuman = createConvertToHumanFn(enableRawBytes);
		const formatter = createFormatter(convertToHuman);

		const logOptions: LoggerOptions = { silent, verbose, externalLogger: this };
		const logger = new Logger(logOptions);

		// validators
		const error = await checkDirPath(path.resolve(archiveDir));

		if (!hasExtension(archivePath)) {
			this.error(" --to should contain extension: 'tar' 'gz' etc in a path");
		}

		let totalBytes: number = 0;
		let totalCompressedBytes: number = 0;
		let totalF = 0;
		let currentFile = 'N/A';

		if (error) {
			this.error(error);
		}

		if (isTTY) {
			logger.info(`${chalk.bold('From')}: ${chalk.dim(from)}`);
			logger.info(`${chalk.bold('To')}: ${chalk.dim(archivePath)}`);
			logger.info(`${chalk.bold('Gzip')}: ${enableGzip ? chalk.green('true') : chalk.red('false')}`);
			logger.info(`${chalk.bold('Exclude')}: `, excludedEntries);
		}

		const isPathShouldExclude = (mpath: string) => {
			return excludedEntries.some((pattern) => micromatch.isMatch(mpath, pattern));
		};
		let { filesNum, totalSize } = await getTotalFilesCountPerf(from, isPathShouldExclude);
		let totalFilesNum = filesNum + 1;

		const progressBar = new ProgressBarTTY(totalFilesNum, totalSize, formatter);
		const output = fs.createWriteStream(archivePath);

		const tarOptions: tarFs.PackOptions = {
			map: (header) => {
				totalF++;
				header.name = `${targetDirName}${path.sep}${header.name}`;
				currentFile = header.name;
				if (!isTTY) {
					this.log(`${header.name} ${header.size}`);
				}
				return header;
			}
		};

		tarOptions.ignore = (mpath) => {
			if (excludedEntries.some((pattern) => micromatch.isMatch(mpath, pattern))) {
				return true;
			} else {
				try {
					const stat = statPath(mpath);
					return stat.isFIFO() || stat.isBlockDevice() || stat.isSocket();
				} catch (err) {
					if (err.code !== 'ENOENT') {
						throw err;
					}
					return true;
				}
			}
		};

		const archive = tarFs.pack(from, tarOptions);
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
			});
		}
	}
}

export = ProjectsBackuper;
