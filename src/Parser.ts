import {
	ClassStmt,
	Expr,
	ExpressionStmt,
	FunctionStmt,
	IfStmt,
	ReturnStmt,
	Stmt,
	VarStmt,
	VariableExpr,
	WhileStmt
} from "./ast";
import { Lox } from "./Lox";
import { Token } from "./Token";
import { TokenType } from "./TokenType";

class ParseError extends SyntaxError {}

export class Parser {
	private current = 0;

	constructor(private tokens: Token[]) {}

	parse() {
		try {
			return this.program();
		} catch {
			return null;
		}
	}

	private program() {
		const declarations: Stmt[] = [];

		while (!this.atEnd()) {
			declarations.push(this.declaration());
		}

		return declarations;
	}

	private declaration(): Stmt {
		try {
			if (this.match(TokenType.VAR)) return this.varDeclaration();
			if (this.match(TokenType.FUN)) return this.function("function");
			if (this.match(TokenType.CLASS)) return this.classDeclaration();

			return this.statement();
		} catch {
			this.synchronize();
			return {
				type: "ExpressionStmt",
				expression: {
					type: "LiteralExpr",
					value: null
				}
			};
		}
	}

	private varDeclaration(): VarStmt {
		const name = this.consume(
			TokenType.IDENTIFIER,
			"Expected variable name."
		);

		const initializer = this.match(TokenType.EQ) ? this.expression() : null;

		this.consume(
			TokenType.SEMICOLON,
			"Expected ';' after variable declaration."
		);

		return {
			type: "VarStmt",
			name,
			initializer
		};
	}

	private function(kind: string): FunctionStmt {
		const name = this.consume(
			TokenType.IDENTIFIER,
			`Expected ${kind} name.`
		);

		this.consume(TokenType.LPAREN, `Expected '(' after ${kind} name.`);

		const params: Token[] = [];

		if (!this.check(TokenType.RPAREN)) {
			do {
				if (params.length >= 255) {
					this.error(
						this.peek(),
						"Cannot have more than 255 parameters."
					);
				}

				params.push(
					this.consume(
						TokenType.IDENTIFIER,
						"Expected parameter name."
					)
				);
			} while (this.match(TokenType.COMMA));
		}

		this.consume(TokenType.RPAREN, "Expected ')' after parameters.");
		this.consume(TokenType.LBRACE, `Expected '{' before ${kind} body.`);

		const body = this.block();

		return {
			type: "FunctionStmt",
			name,
			params,
			body
		};
	}

	private classDeclaration(): ClassStmt {
		const name = this.consume(TokenType.IDENTIFIER, "Expected class name.");

		let superclass: VariableExpr | null = null;
		if (this.match(TokenType.LT)) {
			superclass = {
				type: "VariableExpr",
				name: this.consume(
					TokenType.IDENTIFIER,
					"Expected superclass name."
				)
			};
		}

		this.consume(TokenType.LBRACE, "Expected '{' before class body.");

		const methods: FunctionStmt[] = [];
		while (!this.check(TokenType.RBRACE) && !this.atEnd()) {
			methods.push(this.function("method"));
		}

		this.consume(TokenType.RBRACE, "Expected '}' after class body.");

		return {
			type: "ClassStmt",
			name,
			superclass,
			methods
		};
	}

	private statement(): Stmt {
		if (this.match(TokenType.IF)) return this.ifStatement();
		if (this.match(TokenType.WHILE)) return this.whileStatement();
		if (this.match(TokenType.FOR)) return this.forStatement();
		if (this.match(TokenType.RETURN)) return this.returnStatement();

		if (this.match(TokenType.LBRACE)) {
			return {
				type: "BlockStmt",
				statements: this.block()
			};
		}

		return this.expressionStatement();
	}

	private block(): Stmt[] {
		const statements: Stmt[] = [];

		while (!this.check(TokenType.RBRACE) && !this.atEnd()) {
			statements.push(this.declaration());
		}

		this.consume(TokenType.RBRACE, "Expected '}' after block.");

		return statements;
	}

	private expressionStatement(): ExpressionStmt {
		const expression = this.expression();
		this.consume(TokenType.SEMICOLON, "Expected ';' after expression.");

		return {
			type: "ExpressionStmt",
			expression
		};
	}

	private ifStatement(): IfStmt {
		this.consume(TokenType.LPAREN, "Expected '(' after 'if'.");

		const condition = this.expression();

		this.consume(TokenType.RPAREN, "Expected ')' after if condition.");

		const thenBranch = this.statement();

		const elseBranch = this.match(TokenType.ELSE) ? this.statement() : null;

		return {
			type: "IfStmt",
			condition,
			thenBranch,
			elseBranch
		};
	}

	private whileStatement(): WhileStmt {
		this.consume(TokenType.LPAREN, "Expected '(' after 'while'.");

		const condition = this.expression();

		this.consume(TokenType.RPAREN, "Expected ')' after while condition.");

		const body = this.statement();

		return {
			type: "WhileStmt",
			condition,
			body
		};
	}

	private forStatement(): Stmt {
		this.consume(TokenType.LPAREN, "Expected '(' after 'for'.");

		const initializer = this.match(TokenType.SEMICOLON)
			? null
			: this.match(TokenType.VAR)
			? this.varDeclaration()
			: this.expressionStatement();

		const condition = this.match(TokenType.SEMICOLON)
			? ({ type: "LiteralExpr", value: true } as const)
			: this.expression();

		this.consume(TokenType.SEMICOLON, "Expected ';' after loop condition.");

		const increment = this.match(TokenType.RPAREN)
			? null
			: this.expression();

		this.consume(TokenType.RPAREN, "Expected ')' after for clauses.");

		let body = this.statement();

		if (increment) {
			body = {
				type: "BlockStmt",
				statements: [
					body,
					{
						type: "ExpressionStmt",
						expression: increment
					}
				]
			};
		}

		body = {
			type: "WhileStmt",
			condition,
			body
		};

		if (initializer) {
			body = {
				type: "BlockStmt",
				statements: [initializer, body]
			};
		}

		return body;
	}

	private returnStatement(): ReturnStmt {
		const keyword = this.previous();
		const value = this.match(TokenType.SEMICOLON)
			? null
			: this.expression();

		this.consume(TokenType.SEMICOLON, "Expected ';' after return value.");

		return {
			type: "ReturnStmt",
			keyword,
			value
		};
	}

	private expression(): Expr {
		return this.assignment();
	}

	private assignment(): Expr {
		const expr = this.or();

		if (this.matchAssign()) {
			const equals = this.previous();
			let value = this.assignment();

			if (expr.type !== "VariableExpr" && expr.type !== "GetExpr") {
				this.error(equals, "Invalid assignment target.");
				return expr;
			}

			const type = this.assignToBinaryOperator(equals.type);

			if (expr.type === "VariableExpr") {
				const name = expr.name;
				return {
					type: "AssignExpr",
					name,
					operator: type ? { ...equals, type } : null,
					value
				};
			}

			return {
				...expr,
				type: "SetExpr",
				operator: type ? { ...equals, type } : null,
				value
			};
		}

		return expr;
	}

	private or(): Expr {
		let left = this.and();

		while (this.match(TokenType.OR)) {
			const operator = this.previous();
			const right = this.and();
			left = {
				type: "LogicalExpr",
				left,
				operator,
				right
			};
		}

		return left;
	}

	private and(): Expr {
		let left = this.equality();

		while (this.match(TokenType.AND)) {
			const operator = this.previous();
			const right = this.equality();
			left = {
				type: "LogicalExpr",
				left,
				operator,
				right
			};
		}

		return left;
	}

	private equality(): Expr {
		let left = this.comparison();

		while (this.match(TokenType.BANG_EQ, TokenType.EQ_EQ)) {
			const operator = this.previous();
			const right = this.comparison();
			left = {
				type: "BinaryExpr",
				left,
				operator,
				right
			};
		}

		return left;
	}

	private comparison(): Expr {
		let left = this.term();

		while (
			this.match(
				TokenType.LT,
				TokenType.GT,
				TokenType.LT_EQ,
				TokenType.GT_EQ
			)
		) {
			const operator = this.previous();
			const right = this.term();
			left = {
				type: "BinaryExpr",
				left,
				operator,
				right
			};
		}

		return left;
	}

	private term(): Expr {
		let left = this.factor();

		while (this.match(TokenType.MINUS, TokenType.PLUS)) {
			const operator = this.previous();
			const right = this.factor();
			left = {
				type: "BinaryExpr",
				left,
				operator,
				right
			};
		}

		return left;
	}

	private factor(): Expr {
		let left = this.unary();

		while (this.match(TokenType.SLASH, TokenType.STAR, TokenType.PERCENT)) {
			const operator = this.previous();
			const right = this.unary();
			left = {
				type: "BinaryExpr",
				left,
				operator,
				right
			};
		}

		return left;
	}

	private unary(): Expr {
		if (this.match(TokenType.BANG, TokenType.MINUS)) {
			const operator = this.previous();
			const right = this.unary();
			return {
				type: "UnaryExpr",
				operator,
				right
			};
		}

		return this.call();
	}

	private call(): Expr {
		let expr = this.primary();

		while (true) {
			if (this.match(TokenType.LPAREN)) {
				expr = this.finishCall(expr);
			} else if (this.match(TokenType.DOT)) {
				const name = this.consume(
					TokenType.IDENTIFIER,
					"Expected property name after '.'."
				);
				expr = {
					type: "GetExpr",
					object: expr,
					name
				};
			} else {
				break;
			}
		}

		return expr;
	}

	private finishCall(callee: Expr): Expr {
		const args: Expr[] = [];

		if (!this.check(TokenType.RPAREN)) {
			do {
				if (args.length >= 255) {
					this.error(
						this.peek(),
						"Cannot have more than 255 arguments."
					);
				}

				args.push(this.expression());
			} while (this.match(TokenType.COMMA));
		}

		const paren = this.consume(
			TokenType.RPAREN,
			"Expected ')' after arguments."
		);

		return {
			type: "CallExpr",
			callee,
			paren,
			arguments: args
		};
	}

	private primary(): Expr {
		if (this.match(TokenType.FALSE))
			return { type: "LiteralExpr", value: false };
		if (this.match(TokenType.TRUE))
			return { type: "LiteralExpr", value: true };
		if (this.match(TokenType.NIL))
			return { type: "LiteralExpr", value: null };

		if (this.match(TokenType.NUMBER, TokenType.STRING)) {
			return {
				type: "LiteralExpr",
				value: this.previous().literal
			};
		}

		if (this.match(TokenType.SUPER)) {
			const keyword = this.previous();
			this.consume(TokenType.DOT, "Expected '.' after 'super'.");
			const method = this.consume(
				TokenType.IDENTIFIER,
				"Expected superclass method name."
			);
			return {
				type: "SuperExpr",
				keyword,
				method
			};
		}

		if (this.match(TokenType.THIS)) {
			return {
				type: "ThisExpr",
				keyword: this.previous()
			};
		}

		if (this.match(TokenType.IDENTIFIER)) {
			return {
				type: "VariableExpr",
				name: this.previous()
			};
		}

		if (this.match(TokenType.LPAREN)) {
			const expr = this.expression();
			this.consume(TokenType.RPAREN, "Expected ')' after expression.");
			return {
				type: "GroupingExpr",
				expression: expr
			};
		}

		throw this.error(this.peek(), "Expected expression.");
	}

	private match(...types: TokenType[]) {
		for (const type of types) {
			if (this.check(type)) {
				this.advance();
				return true;
			}
		}

		return false;
	}

	private matchAssign() {
		return this.match(
			TokenType.PLUS_EQ,
			TokenType.MINUS_EQ,
			TokenType.SLASH_EQ,
			TokenType.STAR_EQ,
			TokenType.PERCENT_EQ,
			TokenType.EQ
		);
	}

	private assignToBinaryOperator(type: TokenType) {
		switch (type) {
			case TokenType.PLUS_EQ:
				return TokenType.PLUS;
			case TokenType.MINUS_EQ:
				return TokenType.MINUS;
			case TokenType.SLASH_EQ:
				return TokenType.SLASH;
			case TokenType.STAR_EQ:
				return TokenType.STAR;
			case TokenType.PERCENT_EQ:
				return TokenType.PERCENT;
			default:
				return null;
		}
	}

	private consume(type: TokenType, message: string) {
		if (this.check(type)) {
			return this.advance();
		}

		throw this.error(this.peek(), message);
	}

	private check(type: TokenType) {
		if (this.atEnd()) return false;
		return this.peek().type === type;
	}

	private advance() {
		if (!this.atEnd()) this.current++;
		return this.previous();
	}

	private peek() {
		return this.tokens[this.current];
	}

	private previous() {
		return this.tokens[this.current - 1];
	}

	private atEnd() {
		return this.peek().type === TokenType.EOF;
	}

	private error(token: Token, message: string) {
		Lox.error(token, message);

		return new ParseError();
	}

	private synchronize() {
		this.advance();

		while (!this.atEnd()) {
			if (this.previous().type === TokenType.SEMICOLON) return;

			switch (this.peek().type) {
				case TokenType.CLASS:
				case TokenType.FUN:
				case TokenType.VAR:
				case TokenType.FOR:
				case TokenType.IF:
				case TokenType.WHILE:
				case TokenType.RETURN:
					return;
			}

			this.advance();
		}
	}
}
