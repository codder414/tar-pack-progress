export function convertBytesToHuman(
	bytes: number,
	precision: number = 2,
	type?: 'b' | 'kb' | 'mb' | 'gb' | 'zb' | 'pb'
): string {
	if (bytes < 1024) {
		return `${bytes} b`;
	}
	let remain: [number, string] = [bytes, 'b'];
	let counter = 0;
	let types = ['b', 'kb', 'mb', 'gb', 'zb', 'pb'];

	const hasType = !!type;

	while (remain[0] >= 1024 && counter < types.length) {
		remain = [remain[0] / 1024, types[++counter]];
		if (hasType && type == remain[1]) {
			break;
		}
	}

	const tmpNum = parseInt(`1${'0'.repeat(precision)}`);

	const result = Math.round((remain[0] + Number.EPSILON) * tmpNum) / tmpNum;

	return `${result.toFixed(precision)} ${remain[1]}`;
}

export function calculateCompressRatio(uncompressedSize: number, compressedSize: number): number {
	return Math.round((((uncompressedSize - compressedSize) * 100) / uncompressedSize + Number.EPSILON) * 100) / 100;
}
