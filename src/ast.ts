import { InternalValue, Token } from "./Token";

export interface BinaryExpr {
	type: "BinaryExpr";
	left: Expr;
	operator: Token;
	right: Expr;
}

export interface GroupingExpr {
	type: "GroupingExpr";
	expression: Expr;
}

export interface CallExpr {
	type: "CallExpr";
	callee: Expr;
	paren: Token;
	arguments: Expr[];
}

export interface LiteralExpr {
	type: "LiteralExpr";
	value: InternalValue;
}

export interface LogicalExpr {
	type: "LogicalExpr";
	left: Expr;
	operator: Token;
	right: Expr;
}

export interface UnaryExpr {
	type: "UnaryExpr";
	operator: Token;
	right: Expr;
}

export interface VariableExpr {
	type: "VariableExpr";
	name: Token;
}

export interface AssignExpr {
	type: "AssignExpr";
	name: Token;
	value: Expr;
	operator: Token | null;
}

export interface GetExpr {
	type: "GetExpr";
	name: Token;
	object: Expr;
}

export interface SetExpr {
	type: "SetExpr";
	object: Expr;
	name: Token;
	value: Expr;
	operator: Token | null;
}

export interface ThisExpr {
	type: "ThisExpr";
	keyword: Token;
}

export interface SuperExpr {
	type: "SuperExpr";
	keyword: Token;
	method: Token;
}

export type Expr =
	| BinaryExpr
	| GroupingExpr
	| LiteralExpr
	| UnaryExpr
	| VariableExpr
	| AssignExpr
	| LogicalExpr
	| CallExpr
	| GetExpr
	| SetExpr
	| ThisExpr
	| SuperExpr;

export interface ExpressionStmt {
	type: "ExpressionStmt";
	expression: Expr;
}

export interface VarStmt {
	type: "VarStmt";
	name: Token;
	initializer: Expr | null;
}

export interface BlockStmt {
	type: "BlockStmt";
	statements: Stmt[];
}

export interface ClassStmt {
	type: "ClassStmt";
	name: Token;
	superclass: VariableExpr | null;
	methods: FunctionStmt[];
}

export interface IfStmt {
	type: "IfStmt";
	condition: Expr;
	thenBranch: Stmt;
	elseBranch: Stmt | null;
}

export interface WhileStmt {
	type: "WhileStmt";
	condition: Expr;
	body: Stmt;
}

export interface FunctionStmt {
	type: "FunctionStmt";
	name: Token;
	params: Token[];
	body: Stmt[];
}

export interface ReturnStmt {
	type: "ReturnStmt";
	keyword: Token;
	value: Expr | null;
}

export type Stmt =
	| ExpressionStmt
	| VarStmt
	| BlockStmt
	| IfStmt
	| WhileStmt
	| FunctionStmt
	| ReturnStmt
	| ClassStmt;

export type Visitor<Type extends { type: string }, Returns> = {
	[Key in `visit${Type["type"]}`]: (
		param: Extract<Type, { type: Key }>
	) => Returns;
};
