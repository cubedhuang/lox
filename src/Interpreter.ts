import prompt from "prompt-sync";

import type {
	AssignExpr,
	BinaryExpr,
	BlockStmt,
	CallExpr,
	ClassStmt,
	Expr,
	ExpressionStmt,
	FunctionStmt,
	GetExpr,
	GroupingExpr,
	IfStmt,
	LiteralExpr,
	LogicalExpr,
	ReturnStmt,
	SetExpr,
	Stmt,
	SuperExpr,
	ThisExpr,
	UnaryExpr,
	VarStmt,
	VariableExpr,
	Visitor,
	WhileStmt
} from "./ast";
import { LoxCallable, LoxClass, LoxFunction, LoxInstance } from "./callables";
import { Environment } from "./Environment";
import { Lox } from "./Lox";
import type { InternalValue, Token } from "./Token";
import { TokenType } from "./TokenType";

const input = prompt();

export class RuntimeError extends Error {
	readonly name = "RuntimeError";

	constructor(readonly token: Token, message: string) {
		super(message);
	}
}

export class Return extends Error {
	readonly name = "Return";

	constructor(readonly value: InternalValue) {
		super();
	}
}

export class Interpreter implements Visitor<Stmt | Expr, InternalValue> {
	readonly globals = new Environment();
	private env = this.globals;
	private locals = new Map<Expr, number>();

	constructor() {
		const stringify = this.stringify;
		this.globals.define(
			"print",
			new (class extends LoxCallable {
				arity() {
					return 1;
				}

				call(_interpreter: Interpreter, args: InternalValue[]) {
					console.log(stringify(args[0]));
					return null;
				}
			})()
		);
		this.globals.define(
			"input",
			new (class extends LoxCallable {
				arity() {
					return 1;
				}

				call(_interpreter: Interpreter, args: InternalValue[]) {
					return input(`${args[0]}`);
				}
			})()
		);
		this.globals.define(
			"clock",
			new (class extends LoxCallable {
				arity() {
					return 0;
				}

				call() {
					return Date.now();
				}
			})()
		);

		const LoxObject = new LoxClass("Object", null, new Map());
		this.globals.define("Object", LoxObject);
	}

	evaluate(statements: Stmt[]) {
		try {
			for (const statement of statements) {
				if (statement) this.visit(statement);
				else throw "no statement from parser this should not happen";
			}
		} catch (error) {
			if (error instanceof RuntimeError) {
				Lox.runtimeError(error);
			} else {
				throw error;
			}
		}
	}

	resolve(expr: Expr, depth: number) {
		this.locals.set(expr, depth);
	}

	visit(value: Stmt | Expr): InternalValue {
		switch (value.type) {
			case "LiteralExpr":
				return this.visitLiteralExpr(value);
			case "GroupingExpr":
				return this.visitGroupingExpr(value);
			case "UnaryExpr":
				return this.visitUnaryExpr(value);
			case "BinaryExpr":
				return this.visitBinaryExpr(value);
			case "CallExpr":
				return this.visitCallExpr(value);
			case "LogicalExpr":
				return this.visitLogicalExpr(value);
			case "VariableExpr":
				return this.visitVariableExpr(value);
			case "AssignExpr":
				return this.visitAssignExpr(value);
			case "GetExpr":
				return this.visitGetExpr(value);
			case "SetExpr":
				return this.visitSetExpr(value);
			case "ThisExpr":
				return this.visitThisExpr(value);
			case "SuperExpr":
				return this.visitSuperExpr(value);
			case "ExpressionStmt":
				return this.visitExpressionStmt(value);
			case "VarStmt":
				return this.visitVarStmt(value);
			case "BlockStmt":
				return this.visitBlockStmt(value);
			case "IfStmt":
				return this.visitIfStmt(value);
			case "WhileStmt":
				return this.visitWhileStmt(value);
			case "FunctionStmt":
				return this.visitFunctionStmt(value);
			case "ReturnStmt":
				return this.visitReturnStmt(value);
			case "ClassStmt":
				return this.visitClassStmt(value);
		}
	}

	visitLiteralExpr(expr: LiteralExpr) {
		return expr.value;
	}

	visitGroupingExpr(expr: GroupingExpr) {
		return this.visit(expr.expression);
	}

	visitUnaryExpr(expr: UnaryExpr) {
		const right = this.visit(expr.right);

		switch (expr.operator.type) {
			case TokenType.MINUS:
				if (right === null) {
					throw new RuntimeError(
						expr.operator,
						"Unary minus on nil is not supported."
					);
				}
				return -right;
			case TokenType.BANG:
				return !right;
		}

		return null;
	}

	visitBinaryExpr(expr: BinaryExpr) {
		const left = this.visit(expr.left);
		const right = this.visit(expr.right);

		return this.binaryOp(expr.operator, left, right);
	}

	visitAssignExpr(expr: AssignExpr) {
		let value = this.visit(expr.value);

		const distance = this.locals.get(expr);

		if (expr.operator) {
			const current = this.lookUpVariable(expr.name, expr);

			value = this.binaryOp(expr.operator, current, value);
		}

		if (distance !== undefined) {
			this.env.assignAt(distance, expr.name, value);
		} else {
			this.globals.assign(expr.name, value);
		}

		return value;
	}

	visitVariableExpr(expr: VariableExpr) {
		return this.lookUpVariable(expr.name, expr);
	}

	visitLogicalExpr(expr: LogicalExpr) {
		const left = this.visit(expr.left);

		if (expr.operator.type === TokenType.OR) {
			if (left) return left;
		} else {
			if (!left) return left;
		}

		return this.visit(expr.right);
	}

	visitCallExpr(expr: CallExpr) {
		const callee = this.visit(expr.callee);

		const args = expr.arguments.map(arg => this.visit(arg));

		if (
			typeof callee !== "object" ||
			callee === null ||
			!("call" in callee)
		) {
			throw new RuntimeError(
				expr.paren,
				"Can only call functions and classes."
			);
		}

		if (args.length !== callee.arity()) {
			throw new RuntimeError(
				expr.paren,
				`Expected ${callee.arity()} arguments but got ${args.length}.`
			);
		}

		return callee.call(this, args);
	}

	visitGetExpr(expr: GetExpr) {
		const object = this.visit(expr.object);

		if (!(object instanceof LoxInstance)) {
			throw new RuntimeError(
				expr.name,
				"Only instances have properties."
			);
		}

		return object.get(expr.name);
	}

	visitSetExpr(expr: SetExpr) {
		const object = this.visit(expr.object);

		if (!(object instanceof LoxInstance)) {
			throw new RuntimeError(
				expr.name,
				"Only instances have properties."
			);
		}

		let value = this.visit(expr.value);

		if (expr.operator) {
			const current = object.get(expr.name);

			value = this.binaryOp(expr.operator, current, value);
		}

		object.set(expr.name, value);
		return value;
	}

	visitThisExpr(expr: ThisExpr) {
		return this.lookUpVariable(expr.keyword, expr);
	}

	visitSuperExpr(expr: SuperExpr) {
		const distance = this.locals.get(expr)!;
		const superclass = this.env.getAt(distance, "super") as LoxClass;
		const object = this.env.getAt(distance - 1, "this") as LoxInstance;

		const method = superclass.findMethod(expr.method.lexeme);

		if (method === null) {
			throw new RuntimeError(
				expr.method,
				`Undefined property '${expr.method.lexeme}'.`
			);
		}

		return method.bind(object);
	}

	visitExpressionStmt(stmt: ExpressionStmt) {
		this.visit(stmt.expression);
		return null;
	}

	visitVarStmt(stmt: VarStmt) {
		const value = stmt.initializer ? this.visit(stmt.initializer) : null;

		this.env.define(stmt.name.lexeme, value);
		return null;
	}

	visitBlockStmt(stmt: BlockStmt) {
		this.executeBlock(stmt.statements, new Environment(this.env));
		return null;
	}

	visitIfStmt(stmt: IfStmt) {
		if (this.visit(stmt.condition)) {
			this.visit(stmt.thenBranch);
		} else if (stmt.elseBranch) {
			this.visit(stmt.elseBranch);
		}
		return null;
	}

	visitWhileStmt(stmt: WhileStmt) {
		while (this.visit(stmt.condition)) {
			this.visit(stmt.body);
		}
		return null;
	}

	visitFunctionStmt(stmt: FunctionStmt) {
		const fun = new LoxFunction(stmt, this.env);
		this.env.define(stmt.name.lexeme, fun);
		return null;
	}

	visitReturnStmt(stmt: ReturnStmt) {
		const value = stmt.value ? this.visit(stmt.value) : null;

		throw new Return(value);

		// @ts-ignore
		return null;
	}

	visitClassStmt(stmt: ClassStmt) {
		const superclass = stmt.superclass ? this.visit(stmt.superclass) : null;
		if (superclass && !(superclass instanceof LoxClass)) {
			throw new RuntimeError(
				stmt.superclass!.name,
				"Superclass must be a class."
			);
		}

		this.env.define(stmt.name.lexeme, null);

		if (stmt.superclass) {
			this.env = new Environment(this.env);
			this.env.define("super", superclass);
		}

		const methods = new Map<string, LoxFunction>();
		for (const method of stmt.methods) {
			const fun = new LoxFunction(method, this.env);
			methods.set(method.name.lexeme, fun);
		}

		const klass = new LoxClass(
			stmt.name.lexeme,
			superclass as LoxClass | null,
			methods
		);

		if (stmt.superclass) {
			this.env = this.env.enclosing!;
		}

		this.env.assign(stmt.name, klass);

		return null;
	}

	executeBlock(statements: Stmt[], env: Environment) {
		const previous = this.env;

		try {
			this.env = env;

			for (const statement of statements) {
				this.visit(statement);
			}
		} finally {
			this.env = previous;
		}
	}

	private lookUpVariable(name: Token, expr: Expr) {
		const distance = this.locals.get(expr);

		if (distance !== undefined) {
			return this.env.getAt(distance, name.lexeme);
		} else {
			return this.globals.get(name);
		}
	}

	private binaryOp(
		operator: Token,
		left: InternalValue,
		right: InternalValue
	) {
		switch (operator.type) {
			case TokenType.PLUS:
				// @ts-ignore
				return left + right;
			case TokenType.MINUS:
				// @ts-ignore
				return left - right;
			case TokenType.SLASH:
				// @ts-ignore
				return left / right;
			case TokenType.STAR:
				// @ts-ignore
				return left * right;
			case TokenType.PERCENT:
				// @ts-ignore
				return left % right;
			case TokenType.BANG_EQ:
				return left !== right;
			case TokenType.EQ_EQ:
				return left === right;
			case TokenType.GT:
				// @ts-ignore
				return left > right;
			case TokenType.GT_EQ:
				// @ts-ignore
				return left >= right;
			case TokenType.LT:
				// @ts-ignore
				return left < right;
			case TokenType.LT_EQ:
				// @ts-ignore
				return left <= right;
		}

		return null;
	}

	private stringify(value: any) {
		if (value === null) return "nil";

		return value.toString();
	}
}
