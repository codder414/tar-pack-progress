// function flatten<T>(items: T[][]): T[] {
// 	let newItems: T[] = [];
// 	for (let item of items) {
// 		newItems = [...newItems, ...item];
// 	}
// 	return newItems;
// }

// type ValueOrArray<T> = T | Array<ValueOrArray<T>>;

// function flattenDeep<T>(items: ValueOrArray<T>[]): T[] {
// 	let stack = items;
// 	let first;
// 	const result = [];

// 	while (stack.length > 0) {
// 		[first] = stack;
// 		if (Array.isArray(first)) {
// 			stack.splice(0, 1, first);
// 		} else {
// 			result.push(first);
// 			stack.splice(0, 1);
// 		}
// 	}

// 	return result;
// }

// const ff = flattenDeep([[[1]], [2], 3, 4, [5, [6, [[[7]]]]]]);
// console.log(ff);

// function isString(item: unknown): item is string {
// 	return typeof item === 'string';
// }

// const a = [['a'], ['b', 'c']];
// const b = [[1, 2], [3, 4], [5], [6]];

// const resultA = flatten(a);
// const resultB = flatten(b);
