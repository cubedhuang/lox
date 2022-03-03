import { FunctionStmt } from "./ast";
import { Environment } from "./Environment";
import { Interpreter, Return, RuntimeError } from "./Interpreter";
import { InternalValue, Token } from "./Token";

export abstract class LoxCallable {
	abstract arity(): number;
	abstract call(
		interpreter: Interpreter,
		args: InternalValue[]
	): InternalValue;

	toString() {
		return "<native fn>";
	}
}

export class LoxFunction extends LoxCallable {
	constructor(
		private readonly declaration: FunctionStmt,
		private readonly closure: Environment,
		private readonly isInitializer = false
	) {
		super();
	}

	arity() {
		return this.declaration.params.length;
	}

	call(interpreter: Interpreter, args: InternalValue[]) {
		const environment = new Environment(this.closure);

		for (let i = 0; i < this.declaration.params.length; i++) {
			environment.define(this.declaration.params[i].lexeme, args[i]);
		}

		try {
			interpreter.executeBlock(this.declaration.body, environment);
		} catch (e) {
			if (!(e instanceof Return)) throw e;

			if (this.isInitializer) {
				return this.closure.getAt(0, "this");
			}

			return e.value;
		}

		if (!this.isInitializer) return null;

		return this.closure.getAt(0, "this");
	}

	bind(instance: LoxInstance) {
		const environment = new Environment(this.closure);
		environment.define("this", instance);

		return new LoxFunction(this.declaration, environment);
	}

	toString() {
		return `<fun ${this.declaration.name.lexeme}>`;
	}
}

export class LoxClass extends LoxCallable {
	constructor(
		readonly name: string,
		readonly superclass: LoxClass | null,
		private readonly methods: Map<string, LoxFunction>
	) {
		super();
	}

	arity() {
		const initializer = this.findMethod("init");
		if (initializer) return initializer.arity();
		return 0;
	}

	call(interpreter: Interpreter, args: InternalValue[]) {
		const instance = new LoxInstance(this);

		const initializer = this.findMethod("init");
		if (initializer) {
			initializer.bind(instance).call(interpreter, args);
		}

		return instance;
	}

	hasMethod(method: string): boolean {
		return this.methods.has(method) || !!this.superclass?.hasMethod(method);
	}

	findMethod(method: string): LoxFunction | null {
		if (this.methods.has(method)) {
			return this.methods.get(method)!;
		}

		if (this.superclass) {
			return this.superclass.findMethod(method);
		}

		return null;
	}

	toString() {
		return `<class ${this.name}>`;
	}
}

export class LoxInstance {
	private fields = new Map<string, InternalValue>();

	constructor(private readonly klass: LoxClass) {}

	has(name: Token) {
		return (
			this.fields.has(name.lexeme) || this.klass.hasMethod(name.lexeme)
		);
	}

	get(name: Token) {
		if (this.fields.has(name.lexeme))
			return this.fields.get(name.lexeme) ?? null;

		const method = this.klass.findMethod(name.lexeme);
		if (method) return method.bind(this);

		throw new RuntimeError(name, `Undefined property '${name.lexeme}'`);
	}

	set(name: Token, value: InternalValue) {
		this.fields.set(name.lexeme, value);
	}

	toString() {
		return `<${this.klass.name} instance>`;
	}
}
