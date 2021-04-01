// type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// class Person {
// 	name: string;
// 	age: number;
// 	#password: string;
// 	constructor(name: string, age: number, password: string) {
// 		this.age = age;
// 		this.name = name;
// 		this.#password = password;
// 	}

// 	toJSON(): Json {
// 		return {
// 			name: this.name,
// 			age: this.age,
// 			password: '*'.repeat(this.#password.length)
// 		};
// 	}
// }

// function sanitizeConfidential(obj: Json): Json {
// 	const data = JSON.parse(JSON.stringify(obj));
// 	let stack: any[] = [data];
// 	while (stack.length > 0) {
// 		for (let j in stack[0]) {
// 			if (typeof stack[0][j] === 'object') {
// 				stack.push(stack[0][j]);
// 			} else {
// 				if (/.*pass.*/i.test(j) && typeof stack[0][j] === 'string') {
// 					stack[0][j] = '*'.repeat(stack[0][j].length);
// 				}
// 			}
// 		}
// 		stack.shift();
// 	}
// 	return data;
// }

// function isSimpleObj(obj: Record<string, any>): boolean {
// 	return Object.keys(obj).every((key) => typeof obj[key] !== 'object' || typeof obj[key] !== 'function');
// }

// const person: Json = {
// 	name: 'Vasya',
// 	age: 12,
// 	address: {
// 		street: 'Baker street',
// 		house: 12,
// 		parking: false
// 	},
// 	logins: [{ pass: '123', user: [{ user: 1, pass: '123' }] }, [{ user: { pass: 'qawsed' } }]],
// 	talents: ['kind', 'very good man', 'other stuff'],
// 	rating: [
// 		[4, 4, 4, 5, 5, 4, 5, 4],
// 		[3, 4, 5, 5, 5, 4, 5, 4]
// 	],
// 	users: [
// 		{ login: 'vasya12', pass: '12345' },
// 		{ login: 'max23', pass: 'p@$$w0rd' }
// 	]
// };
// const a = new Person('Vasya', 12, 'qwerty123');

// const b = sanitizeConfidential(person);
// console.log(JSON.stringify(b, null, 2));

// const aa = [[1, 2], [3, 4], [{ items: [5, 6, 7] }]];
// let bb = [...aa];

// if (bb[0] && bb[0][0]) {
// 	bb[0][0] = 9;
// }
// bb[0][0];

function square(x: number): number {
	let z = 1;
	let c = 10;
	for (let i = 0; i < c; i++) {
		const q = x / z;
		z = (q + z) / 2;
	}
	return z;
}

function squareRoot(x: number): number {
	let z = 1;
	let prev = 0;
	let c = 0;
	while (z - prev >= 0.00000000001 || prev - z >= 0.00000000001) {
		prev = z;
		const q = x / z;
		z = (q + z) / 2;
		c++;
	}
	console.log(c);

	return z;
}
;
console.log(squareRoot(512));
