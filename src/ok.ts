const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const interval = async (fn: (...args: unknown[]) => unknown, ms: number, stopCond: () => boolean = () => true) => {
	while (stopCond() !== false) {
		const jobTime = Date.now();
		await fn();
		const jobTimeEnd = Date.now() - jobTime;
		console.log(`Job time: ${jobTimeEnd}`);
		await sleep(ms);
		console.log(`Total time: ${Date.now() - jobTime}`);
	}
};

let c = 0;
interval(async () => {
	await sleep(2000);
	console.log(c++);
}, 500);
