import { Command, flags } from '@oclif/command';
import * as path from 'path';
import * as fs from 'fs';
import * as tar from 'tar';
import * as minimatch from 'minimatch';
import * as zlib from 'zlib';
import * as tarFs from 'tar-fs';

class ProjectsBackuper extends Command {
	static description = 'Backup dir with progress and ignore syntax';

	static flags = {
		version: flags.version({ char: 'v' }),
		help: flags.help({ char: 'h' }),
		from: flags.string({
			description: 'source dir, wich used to archive',
			required: true
		}),
		to: flags.string({
			description: 'destination archive path',
			required: true
		})
	};

	static args = [];

	async run() {
		const { flags } = this.parse(ProjectsBackuper);

		const from = path.resolve(flags.from);
		const targetDirName = path.basename(from);
		const archiveName = path.basename(flags.to);
		const archiveDir = path.join(path.dirname(flags.to));
		const archivePath = path.resolve(path.join(archiveDir, './tmp', archiveName));

		this.log(`Creating "${archiveName}"`);
		this.log(`from "${from}"`);
		this.log(`to ${archivePath}`);

		const normalizedPath = archivePath;
		if (!hasExtension(normalizedPath)) {
			this.error(" --to should contain extension: 'tar' 'gz' etc in a path");
		}

		await tar.c(
			{
				gzip: true,
				file: archivePath,
				C: '',
				preservePaths: false,
				filter: (mpath, stat) => {
					this.log(mpath);
					return !minimatch(mpath, 'node_modules', { matchBase: true });
				},
				noPax: true
			},
			[from]
		);
	}
}

function hasExtension(destPath: string): boolean {
	const parts = destPath.split('/');
	return parts[parts.length - 1].split('.').length > 1;
}

export = ProjectsBackuper;
