class Game {
    constructor(boardElement, peerConnection, onGameOver) {
        this.boardElement = boardElement;
        this.peer = peerConnection;
        this.onGameOver = onGameOver;
        
        // Settings
        this.revealedKings = false;
        
        // Game State
        this.phase = 'setup'; // 'setup', 'waiting', 'playing', 'gameover'
        this.turn = 'host'; // host starts first usually, or we can randomize
        
        // We always view ourselves at the bottom (rows 6 and 7)
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.myPieces = []; // List of pieces we own
        this.opponentPieces = []; // Opponent pieces (we don't know identities until revealed)
        
        this.selectedSquare = null;
        this.validMoves = [];
        this.lastMove = null;
        
        this.initBoardUI(true); // Default to host view initially
    }

    setSettings(settings) {
        this.revealedKings = settings.revealedKings;
    }

    initBoardUI(isHost = true) {
        this.boardElement.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = r;
                square.dataset.col = c;
                
                // Add coordinate labels for left and bottom edges
                if (c === 0) square.setAttribute('data-row-label', isHost ? (8 - r) : (r + 1));
                if (r === 7) square.setAttribute('data-col-label', String.fromCharCode(isHost ? (97 + c) : (104 - c))); // a-h vs h-a
                
                // Setup zone highlighting
                if (r >= 6) {
                    square.classList.add('setup-zone');
                }
                
                square.addEventListener('click', () => this.handleSquareClick(r, c));
                this.boardElement.appendChild(square);
            }
        }
    }

    startSetup() {
        this.phase = 'setup';
        this.boardElement.classList.add('setup-mode');
        this.initBoardUI(this.peer.isHost);
        
        // Reset board logic array
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.lastMove = null;
        this.clearHighlights();
    }

    finishSetup() {
        this.phase = 'waiting';
        this.boardElement.classList.remove('setup-mode');
        // Clear highlights
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('setup-zone');
            sq.classList.remove('highlight');
        });
        
        // Rebuild this.board perfectly from DOM to prevent dragging/swapping logic bugs
        for (let r = 6; r <= 7; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = this.getSquareElement(r, c);
                const pieceDOM = sq.querySelector('.piece');
                if (pieceDOM) {
                    this.board[r][c] = {
                        owner: 'me',
                        type: pieceDOM.dataset.type,
                        hasMoved: false
                    };
                } else {
                    this.board[r][c] = null;
                }
            }
        }
        
        // Collect our board state and send "ready" to opponent
        const setupData = [];
        for (let r = 6; r <= 7; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c]) {
                    setupData.push({
                        r: r,
                        c: c,
                        type: this.board[r][c].type,
                        revealed: this.revealedKings && this.board[r][c].type === 'king'
                    });
                }
            }
        }
        
        this.peer.sendMessage('PLAYER_READY', { setup: setupData });
    }

    startGame(opponentSetupData, isMyTurn) {
        this.phase = 'playing';
        this.turn = isMyTurn ? 'me' : 'opponent';
        
        // Load opponent's pieces. Opponent placed on their 6,7 which is our 0,1
        // (7-r, 7-c)
        opponentSetupData.forEach(p => {
            const myR = 7 - p.r;
            const myC = 7 - p.c;
            
            const piece = {
                owner: 'opponent',
                type: p.type,
                revealed: p.revealed || false,
                hasMoved: false
            };
            this.board[myR][myC] = piece;
        });
        
        this.renderBoard();
        this.updateTurnUI();
    }

    renderBoard() {
        // Clear all squares
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = this.getSquareElement(r, c);
                const existingPiece = sq.querySelector('.piece');
                if (existingPiece) {
                    existingPiece.remove();
                }
                
                const pieceData = this.board[r][c];
                if (pieceData) {
                    const pElem = document.createElement('div');
                    pElem.className = 'piece';
                    
                    if (pieceData.owner === 'me' || pieceData.revealed) {
                        const myColor = this.peer.isHost ? 'white' : 'black';
                        const oppColor = this.peer.isHost ? 'black' : 'white';
                        const c = pieceData.owner === 'me' ? myColor : oppColor;
                        pElem.innerHTML = this.getPieceIcon(pieceData.type, c);
                    } else {
                        // Hidden opponent piece
                        pElem.classList.add('hidden-identity');
                    }
                    sq.appendChild(pElem);
                }
            }
        }
    }
    
    getPieceIcon(type, color) {
        const icons = {
            'king': 'fa-chess-king',
            'queen': 'fa-chess-queen',
            'rook': 'fa-chess-rook',
            'bishop': 'fa-chess-bishop',
            'knight': 'fa-chess-knight',
            'pawn': 'fa-chess-pawn'
        };
        const c = color === 'white' ? '#fff' : '#000';
        const shadow = color === 'white' ? 'drop-shadow(0 0 2px #000)' : 'drop-shadow(0 0 2px #fff)';
        return `<i class="fa-solid ${icons[type]}" style="color: ${c}; font-size: 2.5rem; filter: ${shadow};"></i>`;
    }

    getSquareElement(r, c) {
        return this.boardElement.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
    }

    handleSquareClick(r, c) {
        if (this.phase !== 'playing') return;
        
        const piece = this.board[r][c];
        
        // If it's not my turn, I can't interact
        if (this.turn !== 'me') return;

        // If a square is already selected and we clicked a valid move target
        if (this.selectedSquare && this.isValidMoveTarget(r, c)) {
            this.executeMove(this.selectedSquare.r, this.selectedSquare.c, r, c);
            return;
        }

        // Select own piece
        if (piece && piece.owner === 'me') {
            this.selectedSquare = {r, c};
            this.calculateValidMoves(r, c);
            this.renderHighlights();
        } else {
            this.clearHighlights();
        }
    }

    calculateValidMoves(startR, startC) {
        this.validMoves = [];
        const piece = this.board[startR][startC];
        if (!piece) return;

        const type = piece.type;

        // Logic based on piece type. 
        // Note: NO CHECK VALIDATION. Kings can move into threatened squares.
        if (type === 'pawn') {
            const dir = -1; // Pawns move UP (towards 0)
            
            // Forward 1
            if (startR + dir >= 0 && !this.board[startR + dir][startC]) {
                this.validMoves.push({r: startR + dir, c: startC});
                
                // Forward 2 (allowed from row 6 OR row 7 - special rule)
                if ((startR === 6 || startR === 7) && startR + dir * 2 >= 0 && !this.board[startR + dir * 2][startC]) {
                    this.validMoves.push({r: startR + dir * 2, c: startC});
                }
            }
            
            // Captures (Diagonal)
            if (startR + dir >= 0) {
                if (startC - 1 >= 0 && this.board[startR + dir][startC - 1] && this.board[startR + dir][startC - 1].owner === 'opponent') {
                    this.validMoves.push({r: startR + dir, c: startC - 1, isCapture: true});
                }
                if (startC + 1 < 8 && this.board[startR + dir][startC + 1] && this.board[startR + dir][startC + 1].owner === 'opponent') {
                    this.validMoves.push({r: startR + dir, c: startC + 1, isCapture: true});
                }
            }
            // Note: En Passant requires tracking last move. Simplifying for now, or can implement if time permits.
        }
        else if (type === 'knight') {
            const jumps = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            jumps.forEach(j => this.addIfValid(startR + j[0], startC + j[1]));
        }
        else if (type === 'bishop') {
            this.addSlideMoves(startR, startC, [[-1,-1], [-1,1], [1,-1], [1,1]]);
        }
        else if (type === 'rook') {
            this.addSlideMoves(startR, startC, [[-1,0], [1,0], [0,-1], [0,1]]);
        }
        else if (type === 'queen') {
            this.addSlideMoves(startR, startC, [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]]);
        }
        else if (type === 'king') {
            const steps = [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]];
            steps.forEach(s => this.addIfValid(startR + s[0], startC + s[1]));
        }
    }

    addIfValid(r, c) {
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const target = this.board[r][c];
            if (!target) {
                this.validMoves.push({r, c});
            } else if (target.owner === 'opponent') {
                this.validMoves.push({r, c, isCapture: true});
            }
        }
    }

    addSlideMoves(startR, startC, directions) {
        directions.forEach(dir => {
            let r = startR + dir[0];
            let c = startC + dir[1];
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const target = this.board[r][c];
                if (!target) {
                    this.validMoves.push({r, c});
                } else {
                    if (target.owner === 'opponent') {
                        this.validMoves.push({r, c, isCapture: true});
                    }
                    break; // Blocked by piece
                }
                r += dir[0];
                c += dir[1];
            }
        });
    }

    isValidMoveTarget(r, c) {
        return this.validMoves.some(m => m.r === r && m.c === c);
    }

    renderHighlights() {
        this.clearHighlights();
        
        if (this.selectedSquare) {
            this.getSquareElement(this.selectedSquare.r, this.selectedSquare.c).classList.add('highlight');
        }
        
        this.validMoves.forEach(m => {
            const sq = this.getSquareElement(m.r, m.c);
            if (m.isCapture) {
                sq.classList.add('valid-capture');
            } else {
                sq.classList.add('valid-move');
            }
        });
    }

    clearHighlights() {
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('highlight', 'valid-move', 'valid-capture');
        });
    }

    renderLastMove() {
        document.querySelectorAll('.square.last-move').forEach(sq => {
            sq.classList.remove('last-move');
        });
        
        if (this.lastMove) {
            this.getSquareElement(this.lastMove.fromR, this.lastMove.fromC)?.classList.add('last-move');
            this.getSquareElement(this.lastMove.toR, this.lastMove.toC)?.classList.add('last-move');
        }
    }

    executeMove(fromR, fromC, toR, toC, isOpponent = false) {
        const piece = this.board[fromR][fromC];
        const target = this.board[toR][toC];
        
        let capturedKing = false;

        if (target) {
            // Reveal piece on capture
            target.revealed = true;
            if (target.type === 'king') {
                capturedKing = true;
            }
        }

        // Move piece in state
        this.board[toR][toC] = piece;
        this.board[fromR][fromC] = null;
        piece.hasMoved = true;

        this.lastMove = { fromR, fromC, toR, toC };

        this.clearHighlights();
        this.selectedSquare = null;
        this.validMoves = [];
        this.renderBoard();
        this.renderLastMove();

        if (!isOpponent) {
            // Send to peer (invert coordinates)
            this.peer.sendMessage('MAKE_MOVE', {
                fromR: 7 - fromR,
                fromC: 7 - fromC,
                toR: 7 - toR,
                toC: 7 - toC
            });
            this.turn = 'opponent';
        } else {
            this.turn = 'me';
        }

        this.updateTurnUI();

        if (capturedKing) {
            this.phase = 'gameover';
            this.onGameOver(isOpponent ? 'Rakip' : 'Siz');
        }
    }

    updateTurnUI() {
        document.getElementById('status-you').innerText = this.turn === 'me' ? 'Senin Sıran' : 'Bekliyor';
        document.getElementById('status-opponent').innerText = this.turn === 'opponent' ? 'Düşünüyor' : 'Bekliyor';
        
        if (this.turn === 'me') {
            document.getElementById('status-you').style.color = 'var(--accent-primary)';
            document.getElementById('status-opponent').style.color = 'var(--text-secondary)';
        } else {
            document.getElementById('status-opponent').style.color = 'var(--accent-primary)';
            document.getElementById('status-you').style.color = 'var(--text-secondary)';
        }
    }
}
