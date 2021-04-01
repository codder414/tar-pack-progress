function fib(n: number): bigint {
	let prev = BigInt(-1);
	let curr = BigInt(1);
	if (n < 1) {
		return BigInt(n);
	}
	while (n--) {
		[prev, curr] = [curr, prev + curr];
	}
	return BigInt(curr);
}

const fib2 = (n: number) => {
	let prev = 0,
		next = 1;
	while (n-- && (next = prev + (prev = next)));
	return prev;
};

console.log(fib(10));

function abs(x: number, y: number): number {
	return Math.sqrt(x * y + x * y);
}

console.log(abs(10, 10));
