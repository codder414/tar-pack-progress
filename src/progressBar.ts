import * as cli from 'cli-progress';

export const createFormatter = (fn: (bytes: number) => string) => {
	const tmpFn: cli.GenericFormatter = (options, params, payload): string => {
		const bar = cli.Format.BarFormat(params.progress, options);
		const percentage = Math.round((params.value / params.total) * 100);
		const value = fn(+cli.Format.ValueFormat(params.value, options, 'value'));
		const total = fn(params.total);
		const files = payload.files;
		const file = payload.file;
		return `[${bar}] ${percentage}% | ${value}/${total} | Files: ${files} | File: ${file}`;
	};
	return tmpFn;
};

export class ProgressBarTTY {
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
