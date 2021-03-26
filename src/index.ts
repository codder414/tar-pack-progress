import { Command, flags } from '@oclif/command';
import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as tarFs from 'tar-fs';
import * as micromatch from 'micromatch';
import { convertBytesToHuman, calculateCompressRatio } from './utils';

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
		help: flags.help({ char: 'h' }),
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

		const error = await checkDirPath(path.resolve(archiveDir));
		if (error) {
			this.error(error);
		}

		const verbose = flags.verbose;
		const silent = flags.silent;

		const excludedEntries = flags.exclude;

		let totalBytes: number = 0;
		let totalCompressedBytes: number = 0;
		if (!silent) {
			this.log(`Creating "${archiveName}"`);
			this.log(`from "${from}"`);
			this.log(`to ${archivePath}`);
		}

		if (verbose && !silent) {
			this.log(`gzip compression enabled for "${archiveName}"`);
			if (excludedEntries) {
				this.log(`Ignored paths: `, excludedEntries);
			}
		}

		const normalizedPath = archivePath;
		if (!hasExtension(normalizedPath)) {
			this.error(" --to should contain extension: 'tar' 'gz' etc in a path");
		}
		const tarOptions: tarFs.PackOptions = {
			map: (header) => {
				header.name = `${targetDirName}${path.sep}${header.name}`;
				if (!silent) {
					if (verbose) {
						this.log(`${header.name} ${header.size}`);
					} else {
						this.log(header.name);
					}
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
		const a = this.error;
		const output = fs.createWriteStream(normalizedPath);

		if (enableGzip) {
			const gzipStream = archive.pipe(zlib.createGzip());
			gzipStream.on('data', (chunk) => {
				totalCompressedBytes += chunk.length;
			});
			gzipStream.pipe(output).on('close', () => {
				if (!silent && verbose) {
					this.log(`Uncompressed archive size: ${convertBytesToHuman(totalBytes, 2)}`);
					this.log(`Total compression ratio: ${calculateCompressRatio(totalBytes, totalCompressedBytes)}%`);
				}
				if (!silent) {
					this.log(`Total archive size: ${convertBytesToHuman(totalCompressedBytes, 2)}`);
				}
			});
		} else {
			archive.pipe(output).on('close', () => {
				if (!silent) {
					this.log(`Total archive size: ${convertBytesToHuman(totalBytes, 2)}`);
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

export = ProjectsBackuper;
