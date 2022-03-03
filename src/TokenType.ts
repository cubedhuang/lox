export enum TokenType {
	// Single-character tokens.
	LPAREN,
	RPAREN,
	LBRACE,
	RBRACE,
	COMMA,
	DOT,
	MINUS,
	PLUS,
	SEMICOLON,
	SLASH,
	STAR,
	PERCENT,

	// One or two character tokens.
	BANG,
	BANG_EQ,
	EQ,
	EQ_EQ,
	GT,
	GT_EQ,
	LT,
	LT_EQ,
	PLUS_EQ,
	MINUS_EQ,
	STAR_EQ,
	SLASH_EQ,
	PERCENT_EQ,

	// LiteralExprs.
	IDENTIFIER,
	STRING,
	NUMBER,

	// Keywords.
	AND,
	CLASS,
	ELSE,
	FALSE,
	FUN,
	FOR,
	IF,
	NIL,
	OR,
	RETURN,
	SUPER,
	THIS,
	TRUE,
	VAR,
	WHILE,

	EOF
}
