```
program        : declaration* EOF ;

declaration    : varDecl
               | funDecl
               | classDecl
               | statement ;

varDecl        : "var" IDENTIFIER ( "=" expression )? ";" ;

funDecl        : "fun" function ;

classDecl      : "class" IDENTIFIER ( "<" IDENTIFIER )?
                 "{" function* "}" ;

function       : IDENTIFIER "(" parameters? ")" block ;

parameters     : IDENTIFIER ( "," IDENTIFIER )* ;

statement      : exprStmt
               | ifStmt
               | whileStmt
               | forStmt
               | printStmt
               | returnStmt
               | block ;

block          : "(" declaration* ")" ;

exprStmt       : expression ";" ;

ifStmt         : "if" "(" expression ")" statement
                 ( "else" statement )? ;

whileStmt      : "while" "(" expression ")" statement ;

forStmt        : "for" "(" ( varDecl | exprStmt | ";" )
                 expression? ";"
                 expression? ")" statement ;

printStmt      : "print" expression ";" ;

returnStmt     : "return" expression? ";" ;

expression     : assignment ;

assignment     : ( call "." )? IDENTIFIER
                 ( "=" "+=" "-=" "*=" "/=" "%=") assignment
               | logicOr ;

logicOr        : logicAnd ( "or" logicAnd )* ;

logicAnd       : equality ( "and" equality )* ;

equality       : comparison ( ( "!=" | "==" ) comparison )* ;

comparison     : term ( ( ">" | ">=" | "<" | "<=" ) term )* ;

term           : factor ( ( "-" | "+" ) factor )* ;

factor         : unary ( ( "/" | "*" | "%" ) unary )* ;

unary          : ( "!" | "-" ) unary
               | call ;

call           : primary ( "(" arguments? ")" | "." IDENTIFIER )? ;

arguments      : expression ( "," expression )* ;

primary        : NUMBER | STRING | IDENTIFIER
               | "true" | "false" | "nil" | "this"
               | "(" expression ")"
               | "super" "." IDENTIFIER ;
```
