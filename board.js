import { General, Chariot, Horse, Elephant, Advisor, Pawn, Cannon } from './pieces.js'; 

export class Board {
    constructor() {
        this.board = []; // 10 * 9 array
        this.turn = "red"; 
        this.status = true; // game start 
        this.curPiece = null; 
        this.turnCnt = 0; 
    }

    placePiece(pieceInfo) {
        let type = pieceInfo[0]; 
        let color = pieceInfo[1]; 
        let row = parseInt(pieceInfo[2]); 
        let col = parseInt(pieceInfo[3]); 

        switch (type) {
            case "chariot": 
                var icon = (color == "red") ? "车" : "車"; 
                this.board[row][col] = new Chariot(color, icon, col, row); 
                break; 
            case "horse": 
                var icon = (color == "red") ? "马" : "馬"; 
                this.board[row][col] = new Horse(color, icon, col, row); 
                break; 
            case "elephant": 
                var icon = (color == "red") ? "相" : "象"; 
                this.board[row][col] = new Elephant(color, icon, col, row); 
                break; 
            case "advisor": 
                var icon = (color == "red") ? "仕" : "士"; 
                this.board[row][col] = new Advisor(color, icon, col, row); 
                break; 
            case "general": 
                var icon = (color == "red") ? "帅" : "将"; 
                this.board[row][col] = new General(color, icon, col, row); 
                break; 
            case "cannon": 
                var icon = (color == "red") ? "炮" : "砲"; 
                this.board[row][col] = new Cannon(color, icon, col, row); 
                break; 
            case "pawn": 
                var icon = (color == "red") ? "兵" : "卒";
                this.board[row][col] = new Pawn(color, icon, col, row); 
                break; 
            default: 
                break; 
        }
    }

    initBoard(situation) {
        // generate board
        for (let i=0; i<10; i++) { 
            this.board[i] = []; // create a row 
            for (let j=0; j<9; j++) { 
                this.board[i][j] = null; // create an empty slot 
            }
        }

        situation.forEach((pieceInfo) => {
            this.placePiece(pieceInfo); 
        })
        
        // console.log(this.board); 
    } 

    movePiece(piece, newRow, newCol) { 
        // check if the new position is within the board 
        if (newRow < 0 || newRow > 9 || newCol < 0 || newCol > 8) { 
            return false; 
        }

        // check if suiside
        if (this.isSuisideMove(piece, newRow, newCol, this.board)) {
            console.log("suiside!")
            return false; 
        }
        
        // check if the piece belongs to the board 
        // 原写法 `!this.board[...] === piece` 恒为 false，等于没检查
        if (this.board[piece.row][piece.col] !== piece) { 
            return false; 
        }

        // check if the piece can move to the new position 
        if (!piece.validateMove(newRow, newCol, this.board)) { 
            return false; 
        }

        return true; 
    }

    findEnemies(color, board) {
        var enemies = []; 

        for (let i=0; i<=9; i++) {
            for (let j=0; j<=8; j++) {
                var piece = board[i][j]; 
                if (piece != null && piece.color == color) {
                    enemies.push(board[i][j]); 
                }
            }
        }

        return enemies; 
    }

    // 找出指定颜色自己的将/帅位置。返回 [row, col]；将已被吃光时返回 []。
    // 注意：原实现用 `piece.color != color`，找的是**敌方**将，导致
    // isCheck() 整个语义颠倒，将军提示与将死判定全部失效。
    findGeneral(color, board) {
        for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 8; j++) {
                var piece = board[i][j];
                if (piece != null && piece.type == "general" && piece.color == color) {
                    return [i, j];
                }
            }
        }
        return [];
    }

    // color 方的将/帅当前是否正被对方攻击（被将军）。
    // 逐个对方棋子，模拟它是否能走到我方将的位置；能吃到即为将军。
    isCheck(color, board) {
        var generalPos = this.findGeneral(color, board);
        if (generalPos.length == 0) return false;   // 将已被吃光

        var opponent = (color == "red") ? "black" : "red";
        var enemies = this.findEnemies(opponent, board);

        for (var i = 0; i < enemies.length; i++) {
            if (this.couldCaptureAt(enemies[i], generalPos[0], generalPos[1], board)) {
                return true;
            }
        }
        return false;
    }

    // 敌方棋子 enemy 从当前位置走到 (row, col) 是否能吃到该格的棋子。
    // 用 try/catch 包住 validateMove：车/马/炮等棋子的走法在边界或
    // 被阻挡时会访问越界索引，判定失败应视为"吃不到"。
    couldCaptureAt(enemy, row, col, board) {
        try {
            return enemy.validateMove(row, col, board) === true;
        } catch (e) {
            return false;
        }
    }

    // 试走一步后，走子方自己的将/帅是否被对方将军（自陷/送将）。
    // 关键修正：
    //   1) 原实现判断的是**对方**（color 取反）是否被将军，语义相反；
    //   2) 没有先取出目标格被吃的子，吃子后的局面判断错误。
    isSuisideMove(piece, newRow, newCol, board) {
        var copy = this.copyBoard(board);
        var fromRow = piece.row;
        var fromCol = piece.col;
        var moverColor = piece.color;      // 走完之后要确保**自己**没被将军

        copy[fromRow][fromCol] = null;
        copy[newRow][newCol] = piece;

        // copy 与 board 共享棋子对象引用，必须临时改行列再复位，
        // 否则 validateMove 会用旧坐标判断。
        var oldRow = piece.row;
        var oldCol = piece.col;
        piece.row = newRow;
        piece.col = newCol;

        var flag = this.isCheck(moverColor, copy);

        piece.row = oldRow;
        piece.col = oldCol;

        return flag;
    }

    copyBoard(board) {
        var copy = []; 

        for (let i=0; i<=9; i++) {
            copy[i] = []; 
            for (let j=0; j<=8; j++) {
                copy[i][j] = null; 
            }
        }
        
        for (let i=0; i<=9; i++) {
            for (let j=0; j<=8; j++) {
                copy[i][j] = board[i][j];
            }
        }

        return copy; 
    }

    getPossiblePos(piece) {
        var row = piece.row; 
        var col = piece.col; 
        var dir = piece.dir;
        var type = piece.type; 
        
        var possiblePos = []; 
        if (type == "cannon" || type == "chariot" || type == "horse") {
            for (let i=0; i<dir.length; i++) {
                var len = dir[i].length; 
                for (let j=0; j<len; j++) {
                    var rowChange = dir[i][j][0]; 
                    var colChange = dir[i][j][1]; 
                    
                    if (rowChange == 0 && colChange == 0) continue; 
                    possiblePos.push([row + rowChange, col + colChange]); 
                }
            }
        } else {
            for (let i=0; i<dir.length; i++) {
                var rowChange = dir[i][0]; 
                var colChange = dir[i][1]; 

                if (rowChange == 0 && colChange == 0) continue; 
                possiblePos.push([row + rowChange, col + colChange]); 
            }
        }

        return possiblePos; 
    }

    // color 方是否已被将死：被将军且没有任何合法应对。
    // 关键修正：原实现用 getPossiblePos() 只做直线枚举，不含车/马/炮的
    // 实际阻挡与吃子规则，几乎总能"找到解"，因此永远判不出将死。
    // 这里穷举每个己方棋子的全部合法落点来寻找应对。
    isCheckMate(color, board) {
        if (!this.isCheck(color, board)) return false;   // 未被将军就不是将死

        var ownPieces = this.findEnemies(color, board);   // color 自己的棋子

        for (var i = 0; i < ownPieces.length; i++) {
            var p = ownPieces[i];
            for (var r = 0; r <= 9; r++) {
                for (var c = 0; c <= 8; c++) {
                    if (r == p.row && c == p.col) continue;
                    var target = board[r][c];
                    if (target != null && target.color == p.color) continue; // 不能落在己方子上
                    if (!this.couldCaptureAt(p, r, c, board)) continue;       // 该子走不到/吃不到
                    if (!this.isSuisideMove(p, r, c, board)) return false;   // 存在合法应对
                }
            }
        }
        return true;    // 任何一步都会送将 → 将死
    }
}