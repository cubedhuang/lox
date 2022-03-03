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
import { Interpreter } from "./Interpreter";
import { Lox } from "./Lox";
import type { Token } from "./Token";

enum FunctionType {
	NONE,
	FUNCTION,
	METHOD,
	INITIALIZER
}

enum ClassType {
	NONE,
	CLASS,
	SUBCLASS
}

export class Resolver implements Visitor<Stmt | Expr, void> {
	private scopes: Map<string, boolean>[] = [new Map()];
	private currentFunction = FunctionType.NONE;
	private currentClass = ClassType.NONE;

	constructor(private readonly interpreter: Interpreter) {}

	resolve(value: Stmt[] | Stmt | Expr): any {
		if (Array.isArray(value)) {
			for (const stmt of value) {
				this.resolve(stmt);
			}
			return;
		}

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

	visitLiteralExpr(_expr: LiteralExpr) {}

	visitGroupingExpr(expr: GroupingExpr) {
		this.resolve(expr.expression);
	}

	visitUnaryExpr(expr: UnaryExpr) {
		this.resolve(expr.right);
	}

	visitBinaryExpr(expr: BinaryExpr) {
		this.resolve(expr.left);
		this.resolve(expr.right);
	}

	visitAssignExpr(expr: AssignExpr) {
		this.resolve(expr.value);
		this.resolveLocal(expr, expr.name);
	}

	visitVariableExpr(expr: VariableExpr) {
		if (
			this.scopes.length &&
			this.scopes.at(-1)!.get(expr.name.lexeme) === false
		) {
			Lox.error(
				expr.name,
				"Can't read local variable in its own initializer."
			);
		}

		this.resolveLocal(expr, expr.name);
	}

	visitLogicalExpr(expr: LogicalExpr) {
		this.resolve(expr.left);
		this.resolve(expr.right);
	}

	visitCallExpr(expr: CallExpr) {
		this.resolve(expr.callee);

		for (const arg of expr.arguments) {
			this.resolve(arg);
		}
	}

	visitGetExpr(expr: GetExpr) {
		this.resolve(expr.object);
	}

	visitSetExpr(expr: SetExpr) {
		this.resolve(expr.value);
		this.resolve(expr.object);
	}

	visitThisExpr(expr: ThisExpr) {
		if (this.currentClass === ClassType.NONE) {
			Lox.error(expr.keyword, "Cannot use 'this' outside of a class.");
			return;
		}

		this.resolveLocal(expr, expr.keyword);
	}

	visitSuperExpr(expr: SuperExpr) {
		if (this.currentClass === ClassType.NONE) {
			Lox.error(expr.keyword, "Cannot use 'super' outside of a class.");
		} else if (this.currentClass === ClassType.CLASS) {
			Lox.error(
				expr.keyword,
				"Cannot use 'super' in a class with no superclass."
			);
		}

		this.resolveLocal(expr, expr.keyword);
	}

	visitExpressionStmt(stmt: ExpressionStmt) {
		this.resolve(stmt.expression);
	}

	visitVarStmt(stmt: VarStmt) {
		this.declare(stmt.name);

		if (stmt.initializer !== null) {
			this.resolve(stmt.initializer);
		}

		this.define(stmt.name);
	}

	visitBlockStmt(stmt: BlockStmt) {
		this.beginScope();
		this.resolve(stmt.statements);
		this.endScope();
	}

	visitIfStmt(stmt: IfStmt) {
		this.resolve(stmt.condition);
		this.resolve(stmt.thenBranch);
		if (stmt.elseBranch) this.resolve(stmt.elseBranch);
	}

	visitWhileStmt(stmt: WhileStmt) {
		this.resolve(stmt.condition);
		this.resolve(stmt.body);
	}

	visitFunctionStmt(stmt: FunctionStmt) {
		this.declare(stmt.name);
		this.define(stmt.name);

		this.resolveFunction(stmt, FunctionType.FUNCTION);
	}

	visitReturnStmt(stmt: ReturnStmt) {
		if (this.currentFunction === FunctionType.NONE) {
			Lox.error(stmt.keyword, "Cannot return from top-level code.");
		}

		if (stmt.value) {
			if (this.currentFunction === FunctionType.INITIALIZER) {
				Lox.error(
					stmt.keyword,
					"Cannot return a value from an initializer."
				);
			}

			this.resolve(stmt.value);
		}
	}

	visitClassStmt(stmt: ClassStmt) {
		const enclosing = this.currentClass;
		this.currentClass = ClassType.CLASS;

		this.declare(stmt.name);
		this.define(stmt.name);

		if (stmt.superclass) {
			if (stmt.name.lexeme === stmt.superclass.name.lexeme) {
				Lox.error(
					stmt.superclass.name,
					"A class cannot inherit from itself."
				);
			}

			this.currentClass = ClassType.SUBCLASS;
			this.resolve(stmt.superclass);

			this.beginScope();
			this.scopes.at(-1)!.set("super", true);
		}

		this.beginScope();
		this.scopes.at(-1)!.set("this", true);

		for (const method of stmt.methods) {
			this.resolveFunction(
				method,
				method.name.lexeme === "init"
					? FunctionType.INITIALIZER
					: FunctionType.METHOD
			);
		}

		this.endScope();

		if (stmt.superclass) {
			this.endScope();
		}

		this.currentClass = enclosing;
	}

	private beginScope() {
		this.scopes.push(new Map<string, boolean>());
	}

	private endScope() {
		this.scopes.pop();
	}

	private declare(name: Token) {
		if (!this.scopes.length) return;

		const scope = this.scopes.at(-1)!;

		if (scope.has(name.lexeme)) {
			Lox.error(
				name,
				"Variable with this name already declared in this scope."
			);
		}

		scope.set(name.lexeme, false);
	}

	private define(name: Token) {
		this.scopes.at(-1)?.set(name.lexeme, true);
	}

	private resolveLocal(expr: Expr, name: Token) {
		for (let i = this.scopes.length - 1; i >= 0; i--) {
			if (this.scopes[i].has(name.lexeme)) {
				this.interpreter.resolve(expr, this.scopes.length - i - 1);
				return;
			}
		}
	}

	private resolveFunction(fun: FunctionStmt, type: FunctionType) {
		const enclosing = this.currentFunction;
		this.currentFunction = type;

		this.beginScope();

		for (const param of fun.params) {
			this.declare(param);
			this.define(param);
		}

		this.resolve(fun.body);

		this.endScope();

		this.currentFunction = enclosing;
	}
}
