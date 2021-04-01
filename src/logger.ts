enum LogLevel {
	Silent = 0,
	Common = 1 << 0,
	Verbose = 1 << 1
}
type LogLevelStr = keyof typeof LogLevel;

export type LoggerOptions = {
	externalLogger: any;
	verbose: boolean;
	silent: boolean;
};

export class Logger {
	private logLevel: number;
	private externalLogger: any;
	constructor({ externalLogger, silent, verbose }: LoggerOptions) {
		this.logLevel = getLogLevel(silent, verbose);
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
