import { Lox } from "./Lox";
import { Token } from "./Token";
import { TokenType } from "./TokenType";

export class Lexer {
	private tokens: Token[] = [];
	private start = 0;
	private current = 0;
	private line = 1;
	private column = 0;

	private static keywords: Record<string, TokenType> = {
		and: TokenType.AND,
		class: TokenType.CLASS,
		else: TokenType.ELSE,
		false: TokenType.FALSE,
		for: TokenType.FOR,
		fun: TokenType.FUN,
		if: TokenType.IF,
		nil: TokenType.NIL,
		or: TokenType.OR,
		return: TokenType.RETURN,
		super: TokenType.SUPER,
		this: TokenType.THIS,
		true: TokenType.TRUE,
		var: TokenType.VAR,
		while: TokenType.WHILE
	};

	constructor(public readonly src: string) {}

	getTokens() {
		while (!this.atEnd()) {
			this.start = this.current;
			this.getToken();
		}

		this.tokens.push({
			type: TokenType.EOF,
			lexeme: "",
			literal: null,
			line: this.line,
			column: this.column
		});
		return this.tokens;
	}

	private getToken() {
		const c = this.advance();

		switch (c) {
			case "(":
				this.addToken(TokenType.LPAREN);
				break;
			case ")":
				this.addToken(TokenType.RPAREN);
				break;
			case "{":
				this.addToken(TokenType.LBRACE);
				break;
			case "}":
				this.addToken(TokenType.RBRACE);
				break;
			case ",":
				this.addToken(TokenType.COMMA);
				break;
			case ".":
				this.addToken(TokenType.DOT);
				break;
			case "+":
				this.addMatchEq(TokenType.PLUS, TokenType.PLUS_EQ);
				break;
			case "-":
				this.addMatchEq(TokenType.MINUS, TokenType.MINUS_EQ);
				break;
			case "*":
				this.addMatchEq(TokenType.STAR, TokenType.STAR_EQ);
				break;
			case "%":
				this.addMatchEq(TokenType.PERCENT, TokenType.PERCENT_EQ);
				break;
			case ";":
				this.addToken(TokenType.SEMICOLON);
				break;

			case "!":
				this.addMatchEq(TokenType.BANG, TokenType.BANG_EQ);
				break;
			case "=":
				this.addMatchEq(TokenType.EQ, TokenType.EQ_EQ);
				break;
			case "<":
				this.addMatchEq(TokenType.LT, TokenType.LT_EQ);
				break;
			case ">":
				this.addMatchEq(TokenType.GT, TokenType.GT_EQ);
				break;

			case "/":
				if (this.match("/")) {
					// A comment goes until the end of the line.
					while (this.peek() !== "\n" && !this.atEnd()) {
						this.advance();
					}
				} else {
					this.addMatchEq(TokenType.SLASH, TokenType.SLASH_EQ);
				}
				break;

			case " ":
			case "\r":
				break;

			case "\t":
				this.column += 3;
				break;

			case "\n":
				this.column = 0;
				this.line++;
				break;

			case '"':
				this.addString();
				break;

			default:
				if (this.isDigit(c)) {
					this.addNumber();
				} else if (this.isAlpha(c)) {
					this.addIdentifier();
				} else {
					Lox.error(
						this.line,
						this.column,
						`Unexpected character: ${c}`
					);
				}
				break;
		}
	}

	private addString() {
		while (this.peek() !== '"' && !this.atEnd()) {
			if (this.peek() === "\n") {
				this.column = 0;
				this.line++;
			}
			this.advance();
		}

		if (this.atEnd()) {
			Lox.error(this.line, this.column, "Unterminated string.");
			return;
		}

		// The closing ".
		this.advance();

		// Trim the surrounding quotes.
		const value = this.src.substring(this.start + 1, this.current - 1);
		this.addToken(TokenType.STRING, value);
	}

	private addNumber() {
		while (this.isDigit(this.peek())) this.advance();

		// Look for a fractional part.
		if (this.peek() === "." && this.isDigit(this.peekNext())) {
			// Consume the "."
			this.advance();

			while (this.isDigit(this.peek())) this.advance();
		}

		this.addToken(
			TokenType.NUMBER,
			parseFloat(this.src.substring(this.start, this.current))
		);
	}

	private addIdentifier() {
		while (this.isAlphaNumeric(this.peek())) this.advance();

		const text = this.src.substring(this.start, this.current);
		const type = Lexer.keywords[text] ?? TokenType.IDENTIFIER;
		this.addToken(type);
	}

	private addToken(type: TokenType, literal: any = null) {
		this.tokens.push({
			type,
			lexeme: this.src.substring(this.start, this.current),
			literal,
			line: this.line,
			column: this.column - (this.current - this.start)
		});
	}

	private atEnd() {
		return this.current >= this.src.length;
	}

	private advance() {
		this.column++;
		return this.src.charAt(this.current++);
	}

	private peek() {
		if (this.atEnd()) return "\0";
		return this.src[this.current];
	}

	private peekNext() {
		if (this.current + 1 >= this.src.length) return "\0";
		return this.src[this.current + 1];
	}

	private match(expected: string) {
		if (this.atEnd() || this.src[this.current] !== expected) {
			return false;
		}

		this.column++;
		this.current++;
		return true;
	}

	private addMatchEq(noEq: TokenType, eq: TokenType) {
		if (this.match("=")) {
			this.addToken(eq);
		} else {
			this.addToken(noEq);
		}
	}

	private isDigit(c: string) {
		return c >= "0" && c <= "9";
	}

	private isAlpha(c: string) {
		return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
	}

	private isAlphaNumeric(c: string) {
		return this.isDigit(c) || this.isAlpha(c);
	}
}
