import { LoxCallable, LoxClass, LoxInstance } from "callables";
import { TokenType } from "./TokenType";

export type InternalValue =
	| string
	| number
	| boolean
	| null
	| LoxCallable
	| LoxClass
	| LoxInstance;

export interface Token {
	type: TokenType;
	lexeme: string;
	literal: InternalValue;
	line: number;
	column: number;
}
