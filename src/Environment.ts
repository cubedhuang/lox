import { RuntimeError } from "./Interpreter";
import { InternalValue, Token } from "./Token";

export class Environment {
	values = new Map<string, InternalValue>();

	constructor(readonly enclosing: Environment | null = null) {}

	get(name: Token): InternalValue {
		if (this.values.has(name.lexeme)) {
			return this.values.get(name.lexeme)!;
		}

		if (this.enclosing) {
			return this.enclosing.get(name);
		}

		throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
	}

	define(name: string, value: InternalValue) {
		this.values.set(name, value);
	}

	assign(name: Token, value: InternalValue): void {
		if (this.values.has(name.lexeme)) {
			this.values.set(name.lexeme, value);
			return;
		}

		if (this.enclosing) {
			this.enclosing.assign(name, value);
			return;
		}

		throw new RuntimeError(name, `Undefined variable '${name.lexeme}'.`);
	}

	getAt(distance: number, name: string): InternalValue {
		return this.ancestor(distance)?.values.get(name) ?? null;
	}

	assignAt(distance: number, name: Token, value: InternalValue) {
		this.ancestor(distance)?.values.set(name.lexeme, value);
	}

	ancestor(distance: number) {
		let environment: Environment | null = this;
		for (let i = 0; i < distance; i++) {
			environment = environment?.enclosing ?? null;
		}
		return environment;
	}
}
