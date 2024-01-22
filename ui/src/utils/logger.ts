export enum LogLevel {
	TRACE,
	DEBUG,
	INFO,
	WARN,
	ERROR,
};

export default class Logger {
	protected static level: LogLevel = LogLevel.INFO;

	static setLevel = (level: LogLevel) => {
		this.level = level;
	}

	static trace = (...args: any[]) => {
		if (this.level <= LogLevel.TRACE) {
			console.trace(...args);
		}
	}

	static debug = (...args: any[]) => {
		if (this.level <= LogLevel.DEBUG) {
			console.debug(...args);
		}
	}

	static info = (...args: any[]) => {
		if (this.level <= LogLevel.INFO) {
			console.info(...args);
		}
	}

	static log = (...args: any[]) => {
		if (this.level <= LogLevel.INFO) {
			console.log(...args);
		}
	}

	static warn = (...args: any[]) => {
		if (this.level <= LogLevel.WARN) {
			console.warn(...args);
		}
	}

	static error = (...args: any[]) => {
		if (this.level <= LogLevel.ERROR) {
			console.error(...args);
		}
	}
}
