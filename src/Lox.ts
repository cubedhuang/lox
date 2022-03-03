import chalk from "chalk";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { Interpreter, RuntimeError } from "./Interpreter";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { Resolver } from "./Resolver";
import { Token } from "./Token";
import { TokenType } from "./TokenType";

const args = process.argv.slice(2);

export class Lox {
	static hadError = false;
	static hadRuntimeError = false;

	private static src = "";
	private static file = "";
	static readonly interpreter = new Interpreter();

	static main() {
		if (args.length > 1) {
			console.log("Usage: tslox [script]");
			process.exit(64);
		} else if (args.length === 1) {
			this.runFile(args[0]);
		} else {
			this.runPrompt();
		}
	}

	private static runFile(path: string) {
		const src = readFileSync(path, { encoding: "utf-8" });

		this.file = path;
		this.run(src);

		if (this.hadError) process.exit(65);
		if (this.hadRuntimeError) process.exit(70);
	}

	private static runPrompt() {
		this.file = "<repl>";

		const rl = createInterface({
			input: process.stdin,
			output: process.stdout
		});

		rl.setPrompt("\ntslox> ");
		rl.prompt();
		rl.on("line", src => {
			if (src === "exit") process.exit(0);

			this.run(src);
			rl.prompt();

			this.hadError = false;
			this.hadRuntimeError = false;
		});
	}

	private static run(src: string) {
		this.src = src;

		const lexer = new Lexer(src);
		const tokens = lexer.getTokens();

		if (this.hadError) return;

		const parser = new Parser(tokens);
		const statements = parser.parse();

		if (this.hadError || !statements) return;

		const resolver = new Resolver(this.interpreter);
		resolver.resolve(statements);

		if (this.hadError) return;

		this.interpreter.evaluate(statements);
	}

	static error(token: Token, message: string): void;
	static error(line: number, column: number, message: string): void;
	static error(...args: [Token, string] | [number, number, string]) {
		if (args.length === 2) {
			const [token, message] = args;

			if (token.type === TokenType.EOF) {
				this.reportError(token.line, token.column, " at end", message);
			} else {
				this.reportError(
					token.line,
					token.column,
					" at '" + token.lexeme + "'",
					message
				);
			}
		} else {
			const [line, column, message] = args;

			this.reportError(line, column, "", message);
		}

		this.hadError = true;
	}

	static runtimeError(error: RuntimeError) {
		this.reportError(
			error.token.line,
			error.token.column,
			"",
			error.message,
			"RuntimeError"
		);

		this.hadRuntimeError = true;
	}

	private static reportError(
		line: number,
		column: number,
		where: string,
		message: string,
		errorName = "Error"
	) {
		// if (Math.random() < 1) {
		// 	const colors = [
		// 		chalk.red,
		// 		chalk.yellow,
		// 		chalk.green,
		// 		chalk.blue,
		// 		chalk.magenta,
		// 		chalk.cyan,
		// 		chalk.white
		// 	];
		// 	const messages = ["bitch learn to code", "💀", "L + ratio"];
		// 	console.error(
		// 		colors[Math.floor(Math.random() * colors.length)](
		// 			messages[Math.floor(Math.random() * messages.length)]
		// 		)
		// 	);
		// 	return;
		// }

		console.error(chalk.redBright(`${errorName}${where}: ${message}`));
		console.error(
			chalk.dim(`  At file ${this.file}, line ${line}, column ${column}`)
		);
		console.error(this.addArrow(line, column));
	}

	private static addArrow(line: number, column: number): string {
		const srcLine = this.src.split("\n", line)[line - 1];

		return `${srcLine.replaceAll("\t", "    ")}\n${" ".repeat(
			column
		)}^ HERE`;
	}
}
