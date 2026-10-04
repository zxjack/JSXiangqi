// 一步走棋的完整快照，足以把局面回退到这步之前。
// movePiece / killedPiece 直接引用 Board.board 数组里的对象（不是拷贝），
// 所以我们只回滚 board 的引用 + movePiece 的 row/col 即可。
export class Record {
    constructor(prevRow, prevCol, newRow, newCol, movePiece, killedPiece) {
        this.prevRow = prevRow;
        this.prevCol = prevCol;
        this.newRow = newRow;
        this.newCol = newCol;
        this.movePiece = movePiece;
        this.killedPiece = killedPiece;
    }

    // 把 board 数组和 movePiece 的位置恢复到走这步之前的状态。
    retractMove(board) {
        board[this.newRow][this.newCol] = this.killedPiece;
        board[this.prevRow][this.prevCol] = this.movePiece;
        this.movePiece.row = this.prevRow;
        this.movePiece.col = this.prevCol;
    }
}
