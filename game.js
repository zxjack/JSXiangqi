import { Board } from './board.js'; 
import { Record } from './record.js';
import { fetchEndgame, fetchList } from './api.js';

const chessboard = new Board(); 
const stack = []; // store movement

const situation = await fetchEndgame(1);
chessboard.initBoard(situation); 

fetchList(); 
const select = document.getElementById("endgame-selector"); 
select.addEventListener("change", async function() { 
    try {
        var index = select.value; 
        var endgame = await fetchEndgame(index); 
        chessboard.initBoard(endgame); 
        deletBoard(); 
        renderBoard(); 
        initListeners();
    } catch {
        console.error(error);
    }
});

// Build the board: #mainContainer holds a #boardFrame wrapper with two layers:
//   1) SVG board background (positioned absolute, behind everything; SVG has
//      pointer-events:none so it never blocks click events).
//   2) #chessboardContainer (the 10x9 cell grid that hosts the pieces).
// The SVG draws: wood-tone background, 9x10 grid lines, 楚河 / 汉界 river
// text, and a "米" (rice/X) pattern in each palace. Cell size 65px, board
// 585 x 650, anchored at the same (170,250) offset as the legacy CSS so
// chessboardContainer lines up without any coordinate math.
(function() {
    window.main = document.createElement("div");
    main.setAttribute("id", "mainContainer");
    document.body.appendChild(main);

    var frame = document.createElement("div");
    frame.setAttribute("id", "boardFrame");
    main.appendChild(frame);

    // --- 棋盘坐标系（唯一真相来源）---
    // CELL = 65px。棋盘是 10 列(col 0..8 之间的 9 条纵线) x 9 行(row 0..9
    // 之间的 10 条横线)，但格子数组是 10 行(row) x 9 列(col)。
    //   格子 (row, col) 中心 = (col*CELL + CELL/2, row*CELL + CELL/2)
    //   棋盘线交点 (row, col)  = (col*CELL, row*CELL)   <-- 棋子在交点上
    // 画布尺寸 = 9*CELL 宽 x 10*CELL 高 = 585 x 650（含右/下半格边距）。
    // 棋子层 #boardPieces 用同样的 65px 网格，因此两者天然对齐。
    window.CELL = 65;   // 暴露给棋子层（第二个 IIFE）共用同一坐标系
    var CELL = window.CELL;
    var W = 9 * CELL;   // 585
    var H = 10 * CELL;  // 650

    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("id", "boardSvg");
    svg.setAttribute("class", "board-svg");
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";

    // Background fill (classic wood tone).
    var bg = document.createElementNS(NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(W));
    bg.setAttribute("height", String(H));
    bg.setAttribute("fill", "#f5deb3");
    svg.appendChild(bg);

    // Helper to add a grid line.
    function line(x1, y1, x2, y2, w) {
        var ln = document.createElementNS(NS, "line");
        ln.setAttribute("x1", x1);
        ln.setAttribute("y1", y1);
        ln.setAttribute("x2", x2);
        ln.setAttribute("y2", y2);
        ln.setAttribute("stroke", "#333");
        ln.setAttribute("stroke-width", w || 1.5);
        ln.setAttribute("stroke-linecap", "square");
        svg.appendChild(ln);
    }

    // 10 条横线：row 0..9，y = row * CELL，横跨 col 0..8。
    for (var r = 0; r <= 9; r++) {
        line(0, r * CELL, 8 * CELL, r * CELL, 1.5);
    }
    // 9 条纵线：col 0..8，x = col * CELL。楚河（第 4/5 行之间）处断开，
    // 这是传统象棋棋盘的画法。
    for (var c = 0; c <= 8; c++) {
        var x = c * CELL;
        line(x, 0,          x, 4 * CELL, 1.5);  // 上半盘
        line(x, 5 * CELL,   x, 9 * CELL, 1.5);  // 下半盘
    }

    // Outer border (thicker frame around the 9x10 grid). Inset by ~3px so
    // the border sits just inside the SVG canvas (585x650) and aligns with
    // the outermost grid lines.
    // 外框：正好贴住最外圈棋盘线 (0,0)-(8*CELL, 9*CELL)，加粗突出。
    var outer = document.createElementNS(NS, "rect");
    outer.setAttribute("x", "0");
    outer.setAttribute("y", "0");
    outer.setAttribute("width", String(8 * CELL));
    outer.setAttribute("height", String(9 * CELL));
    outer.setAttribute("fill", "none");
    outer.setAttribute("stroke", "#333");
    outer.setAttribute("stroke-width", "3");
    svg.appendChild(outer);

    // River text: 楚河 / 汉界 centered in the river strip.
    var textRiver = document.createElementNS(NS, "text");
    textRiver.setAttribute("x", String(4 * CELL));
    textRiver.setAttribute("y", String(4 * CELL + 40));
    textRiver.setAttribute("text-anchor", "middle");
    textRiver.setAttribute("font-size", "26");
    textRiver.setAttribute("font-family", "STKaiti, KaiTi, serif");
    textRiver.setAttribute("fill", "#5a3a1a");
    textRiver.textContent = "\u695A \u6CB3          \u6C49 \u754C";
    svg.appendChild(textRiver);

    // Palace diagonals (米 pattern). Endpoints at the cell CENTERS of the
    // four advisor positions; the two diagonals per palace cross exactly
    // at the center cell center. Cell centers live at (c*65+32.5, r*65+32.5).
    // 九宫斜线端点落在棋盘线交点上：交点 (row, col) = (col*CELL, row*CELL)。
    // 士位是 (0,3) (0,5) (2,3) (2,5)，正好是九宫的四个角交点。
    function palace(r0, r2) {
        function pt(r, c) {
            return [c * CELL, r * CELL];
        }
        var tl = pt(r0, 3), tr = pt(r0, 5);
        var bl = pt(r2, 3), br = pt(r2, 5);
        line(tl[0], tl[1], br[0], br[1], 1.5);  // \ 对角线
        line(tr[0], tr[1], bl[0], bl[1], 1.5);  // // 对角线
    }
    palace(0, 2);  // 黑方九宫：row 0..2, col 3..5
    palace(7, 9);  // 红方九宫：row 7..9, col 3..5

    frame.appendChild(svg);
})();

// 棋子层：在 SVG 棋盘之上放 10x9 个 65px 的定位格。
// 每格用 transform:translate(-50%,-50%) 精确压到 SVG 棋盘线交点上，
// 所以棋子永远落在交点（而不是格子中心），与棋盘线严丝合缝。
(function() {
    window.tBody = document.createElement("div");
    window.tBody.setAttribute("id", "boardPieces");
    var CELL = window.CELL;

    for (var i = 0; i < 10; i++) {
        for (var j = 0; j < 9; j++) {
            var cell = document.createElement("div");
            cell.className = "cell";
            cell.setAttribute("data-x", i);
            cell.setAttribute("data-y", j);
            cell.style.position = "absolute";
            cell.style.left = (j * CELL) + "px";
            cell.style.top = (i * CELL) + "px";
            cell.style.width = CELL + "px";
            cell.style.height = CELL + "px";
            cell.style.transform = "translate(-50%, -50%)";
            cell.addEventListener("click", clickBoard, false);
            tBody.appendChild(cell);
        }
    }
    // 挂在与 SVG 同一个 #boardFrame 内，共用同一原点。
    document.getElementById("boardFrame").appendChild(tBody);
})(); 

// game start
(function() {
    window.checkText = document.createElement("h1");
    window.checkText = document.createElement("h1");
    checkText.style.display="inline";
    checkText.innerHTML="";
    
    checkText.style.position = "absolute";
    checkText.style.top = "150px";
    checkText.style.left ="1000px";
    document.body.appendChild(checkText);
    
    window.beginText = document.createElement("h1");
    beginText.style.display="inline";
    beginText.innerHTML="Game Start";
    beginText.setAttribute("id", "beginText"); 
    
    beginText.style.position = "absolute";
    beginText.style.top = "200px";
    beginText.style.left ="1000px";
    document.body.appendChild(beginText);
})(); 

// initial status
(function() {
    // turn info
    window.turnText = document.createElement("h1");
    turnText.innerHTML = "Red Turn";
    turnText.style.position = "absolute";
    turnText.style.top = "250px";
    turnText.style.left = "1000px";
    document.body.appendChild(turnText);

    // reset button
    var btnContainer = document.createElement("div"); 
    btnContainer.setAttribute("id", "btnContainer");
    btnContainer.style.position = "absolute";
    btnContainer.style.top = "330px";
    btnContainer.style.left = "1000px";
    document.body.appendChild(btnContainer); 

    var restBtn = document.createElement("button");
    restBtn.innerHTML = "New Game";
    restBtn.setAttribute("class", "funcBtn");
    restBtn.addEventListener("click", handleNewGame);
    btnContainer.appendChild(restBtn);

    var resignBtn = document.createElement("button"); 
    resignBtn.innerHTML = "Resign"; 
    resignBtn.setAttribute("class", "funcBtn"); 
    resignBtn.addEventListener("click", handleResign); 
    btnContainer.appendChild(resignBtn); 

    var drawBtn = document.createElement("button"); 
    drawBtn.innerHTML = "Request Draw"; 
    drawBtn.setAttribute("class", "funcBtn"); 
    drawBtn.addEventListener("click", handleDraw);
    btnContainer.appendChild(drawBtn);  

    // record sheet
    var movesContainer = document.createElement("div");
    movesContainer.setAttribute("id", "movesContainer");
    movesContainer.style.position = "absolute";
    movesContainer.style.top = "410px";
    movesContainer.style.left = "1000px";
    movesContainer.style.width = "700px";
    movesContainer.style.height = "430px";
    movesContainer.style.backgroundColor = "lightgray";
    movesContainer.style.overflow = "auto";
    document.body.appendChild(movesContainer);

    // Create the table element
    var moveTable = document.createElement("table");
    moveTable.setAttribute("id", "movesRecords"); 
    movesContainer.appendChild(moveTable);

    // Create the table header row
    var headerRow = moveTable.insertRow();
    var turnHeader = document.createElement("th");
    turnHeader.innerHTML = "Turn";
    headerRow.appendChild(turnHeader);
    var redActionHeader = document.createElement("th");
    redActionHeader.innerHTML = "Red Action";
    headerRow.appendChild(redActionHeader);
    var blackActionHeader = document.createElement("th");
    blackActionHeader.innerHTML = "Black Action";
    headerRow.appendChild(blackActionHeader);

    // Apply spacing between the header cells
    turnHeader.style.paddingLeft = "75px"; 
    turnHeader.style.paddingRight = "75px";
    redActionHeader.style.padding = "0 115px";
    blackActionHeader.style.paddingLeft = "75px";
    blackActionHeader.style.paddingRight = "75px"; 
})();

function handleDraw() {
    alert("request draw"); 
    // impl draw
}

function handleNewGame() {
    console.log("Button clicked!");
    location.reload(); // Refresh the page
}

function handleResign() {
    var winner = (chessboard.turn === "red") ? "Black" : "Red";  
    turnText.innerHTML = winner + " Win!";
    beginText.innerHTML = "Game End"; 
    chessboard.status = false; 
}

// click board
function clickBoard(event) {
    console.log("click board"); 
    if(chessboard.status) { 
        if(chessboard.curPiece) {
            var x = parseInt(this.getAttribute("data-x"));
            var y = parseInt(this.getAttribute("data-y"));

            // attempt to move the piece
            var res = chessboard.movePiece(chessboard.curPiece, x, y);
            if (res) {
                executeMove(x, y);
            } 
        }
        event.stopPropagation();
    } else {
        event.stopPropagation(); // stop popup 
    }     
}

// execute move
function executeMove(newRow, newCol) {
    var curRow = chessboard.curPiece.row; 
    var curCol = chessboard.curPiece.col; 
    chessboard.board[curRow][curCol] = null; 
    chessboard.board[newRow][newCol] = chessboard.curPiece; 

    var source = document.querySelector(`[data-x="${curRow}"][data-y="${curCol}"]`); 
    var tgt = document.querySelector(`[data-x="${newRow}"][data-y="${newCol}"]`); 
    var clickedPiece = source.querySelector('div'); 
    var tgtPiece = tgt.children[0]; 

    source.removeChild(clickedPiece);
    if (tgtPiece != null) {
        tgt.removeChild(tgtPiece); 
    }
    tgt.appendChild(clickedPiece); 
    clickedPiece.style.backgroundColor = "#FAF0E6"; 
    
    moveRecord(curRow, curCol, newRow, newCol, clickedPiece, tgtPiece);
    console.log(stack);  
    switchSide(); // switch side 

    chessboard.curPiece.row = newRow; 
    chessboard.curPiece.col = newCol; 
    chessboard.curPiece = null; 

    var checkRed = chessboard.isCheck("red", chessboard.board); 
    var checkBlack = chessboard.isCheck("black", chessboard.board); 
    if (checkRed || checkBlack) {
        checkText.innerHTML = "Check!"; 
        var checkmateFlag = chessboard.isCheckMate(chessboard.turn, chessboard.board); 
        console.log(chessboard.turn + " is checkmated: " + checkmateFlag); 
        if (checkmateFlag) {
            var winner = (chessboard.turn == "red") ? "Black" : "Red"; 
            checkText.innerHTML = "Checkmate!";
            turnText.innerHTML = winner + " Win"; 
            document.getElementById("beginText").innerHTML = "Game End"; 
            chessboard.status = false; 
        }
    } else {
        checkText.innerHTML = ""; 
    }
    
    initListeners(); 
}

function moveRecord(curRow, curCol, newRow, newCol, clickedPiece, tgtPiece) {
    var moveTable = document.getElementById("movesRecords"); 
    if (chessboard.turn === "red") {
        chessboard.turnCnt++; 
        var moveRow = moveTable.insertRow(); 
        moveRow.setAttribute("class", "moveRow"); 
        moveRow.setAttribute("data-turn", chessboard.turnCnt); 
        var turnContainer = document.createElement("td"); 
        turnContainer.setAttribute("class", "turnCnt"); 
        var redMoveContainer = document.createElement("td");
        redMoveContainer.setAttribute("class", "redMove"); 
        var blackMoveContainer = document.createElement("td");   
        blackMoveContainer.setAttribute("class", "blackMove"); 

        moveRow.appendChild(turnContainer); 
        turnContainer.innerHTML = chessboard.turnCnt; 
        moveRow.appendChild(redMoveContainer); 
        moveRow.appendChild(blackMoveContainer); 
        
        genRedRecord(newRow, newCol, redMoveContainer); 
        var record = new Record(curRow, curCol, newRow, newCol, clickedPiece, tgtPiece); 
        stack.push(record); 
    } else {
        var moveRow = document.querySelector(`[data-turn="${chessboard.turnCnt}"]`); 
        var blackMoveContainer = moveRow.getElementsByClassName("blackMove"); 
        genBlackRecord(newRow, newCol, blackMoveContainer); 
        var record = new Record(curRow, curCol, newRow, newCol, clickedPiece, tgtPiece); 
        stack.push(record); 
    }
}

function genBlackRecord(newRow, newCol, blackMoveContainer) {
    var curRow = chessboard.curPiece.row; 
    var curCol = chessboard.curPiece.col; 
    var curType = chessboard.curPiece.type; 
    var rowChange = newRow - curRow;  
    var text = ""; 

    if (curType === "pawn" || curType === "chariot" || curType === "cannon" || curType === "general") {
        if (curType === "pawn") text += "p";
        if (curType === "chariot") text += "r"; 
        if (curType === "cannon") text += "c"; 
        if (curType === "general") text += "k"; 
        
        if (rowChange > 0) {
            text += (10 - curRow) + "+" + rowChange; 
        } else if (rowChange < 0) {
            text += (10 - curRow) + "" + rowChange;
        } else {
            text += (curCol + 1) + "=" + (newCol + 1); 
        }
    } else if (curType === "horse" || curType === "advisor" || curType === "elephant") {
        if (curType === "horse") text += "n"; 
        if (curType === "advisor") text += "a"; 
        if (curType === "elephant") text += "b"; 

        if (rowChange > 0) {
            text += (curCol + 1) + "+" + (newCol + 1); 
        } else {
            text += (curCol + 1) + "-" + (newCol + 1); 
        }
    }

    blackMoveContainer[0].innerHTML = text; 
    
    return text; 
}

function genRedRecord(newRow, newCol, redMoveContainer) {
    var curRow = chessboard.curPiece.row; 
    var curCol = chessboard.curPiece.col; 
    var curType = chessboard.curPiece.type; 
    var rowChange = curRow - newRow;  
    var text = ""; 

    if (curType === "pawn" || curType === "chariot" || curType === "cannon" || curType === "general") {
        if (curType === "pawn") text += "P";
        if (curType === "chariot") text += "R"; 
        if (curType === "cannon") text += "C"; 
        if (curType === "general") text += "K"; 
        
        if (rowChange > 0) {
            text += (10 - curRow) + "+" + rowChange; 
        } else if (rowChange < 0) {
            text += (10 - curRow) + "" + rowChange;
        } else {
            text += (curCol + 1) + "=" + (newCol + 1); 
        }
    } else if (curType === "horse" || curType === "advisor" || curType === "elephant") {
        if (curType === "horse") text += "N"; 
        if (curType === "advisor") text += "A"; 
        if (curType === "elephant") text += "B"; 

        if (rowChange > 0) {
            text += (curCol + 1) + "+" + (newCol + 1); 
        } else {
            text += (curCol + 1) + "-" + (newCol + 1); 
        }
    }

    redMoveContainer.innerHTML = text; // test red move

    return text; 
}

// switch side
function switchSide() {
    if (chessboard.turn == "red") {
        chessboard.turn = "black"; 
        turnText.innerHTML = "Black Turn"; 
    } else {
        chessboard.turn = "red"; 
        turnText.innerHTML = "Red Turn"; 
    }
}

// choose piece
function choosePiece(event) {
    console.log("choose"); 
    if (chessboard.status) {
        // select piece
        var clickedPiece = event.target;
        console.log(clickedPiece); 
        if (chessboard.turn != clickedPiece.getAttribute("data-color")) return; // avoid control opponent's pieces
        console.log(clickedPiece); 
        if (clickedPiece.classList.contains("pieces")) {
            var x = parseInt(clickedPiece.parentNode.getAttribute("data-x"));
            var y = parseInt(clickedPiece.parentNode.getAttribute("data-y"));
            
            chessboard.curPiece = chessboard.board[x][y];
        }
        
        if (chessboard.turn == clickedPiece.getAttribute("data-color") && chessboard.curPiece) {
            clickedPiece.style.backgroundColor = "#B0E0E6";
            event.stopPropagation();
        }
    } else {
        event.stopPropagation(); // stop popup
    }

    initListeners();
}

// cancel selection 
function cancelPiece(event) {
    console.log("cancel"); 
    var clickedPiece = event.target;
    var selectedPiece = null; 

    if (clickedPiece) {
        var x = parseInt(clickedPiece.parentNode.getAttribute("data-x"));
        var y = parseInt(clickedPiece.parentNode.getAttribute("data-y"));
        selectedPiece = chessboard.board[x][y];
    }

    if (chessboard.status) {
        if (chessboard.curPiece != null && chessboard.curPiece == selectedPiece) {
            clickedPiece.style.backgroundColor = "#FAF0E6";
            chessboard.curPiece = null;
        }
    }

    initListeners();
}

function initListeners() {
    var divs = document.getElementsByClassName("pieces");
    for (var i = 0; i < divs.length; i++) {
        divs[i].removeEventListener("click", choosePiece);
        divs[i].removeEventListener("click", cancelPiece);
  
        if (chessboard.curPiece == null) {
            divs[i].addEventListener("click", choosePiece, false);
        } else {
            divs[i].addEventListener("click", cancelPiece, false);
        }
    }
}

// create pieces
function createPieces(x, y, icon, color) {
    var div = document.createElement("div");
    // div.setAttribute("id", id); 
    div.setAttribute("data-color", color === "red" ? "red" : "black");
    div.classList.add("pieces");
    div.classList.add(color === "red" ? "red" : "black");
    div.appendChild(document.createTextNode(icon));
    // 用 data-x/data-y 精确定位格子（棋子层现在是 div 网格，不是 table）
    tBody.querySelector('div.cell[data-x="' + x + '"][data-y="' + y + '"]').appendChild(div);
    return div;
}

function deletBoard() {
    tBody.querySelectorAll("div.pieces").forEach(function (piece) {
        piece.remove();
    });
}

function renderBoard() {
    for (let i=0; i<=9; i++) {
        for (let j=0; j<=8; j++) {
            var piece = chessboard.board[i][j]; 
            if (piece != null) {
                createPieces(i, j, piece.icon, piece.color); 
            }
        }
    }
}

renderBoard(); 
// initListeners() must run after renderBoard() created the .pieces divs.
// The legacy line `window.addEventListener("load", initListeners)` fails
// because this script is loaded as <script type="module"> (defer-like), so
// the load event has already fired by the time we reach this point. Call
// it directly. renderBoard() runs at line 564 just above.
initListeners();
