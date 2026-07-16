class DragDropManager {
    constructor(game) {
        this.game = game;
        this.draggedElement = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('dragstart', (e) => this.handleDragStart(e));
        document.addEventListener('dragover', (e) => this.handleDragOver(e));
        document.addEventListener('drop', (e) => this.handleDrop(e));
        document.addEventListener('dragend', (e) => this.handleDragEnd(e));
    }

    createInitialPieces(containerElement) {
        const pieces = [
            'king', 'queen', 
            'rook', 'rook', 
            'bishop', 'bishop', 
            'knight', 'knight',
            'pawn', 'pawn', 'pawn', 'pawn', 
            'pawn', 'pawn', 'pawn', 'pawn'
        ];

        containerElement.innerHTML = '';
        pieces.forEach((type, index) => {
            const piece = document.createElement('div');
            piece.className = 'piece';
            piece.draggable = true;
            piece.dataset.type = type;
            piece.dataset.id = `piece-${index}`;
            piece.innerHTML = this.game.getPieceIcon(type, 'white');
            containerElement.appendChild(piece);
        });
    }

    handleDragStart(e) {
        if (!e.target.classList.contains('piece') || this.game.phase !== 'setup') return;
        
        this.draggedElement = e.target;
        e.dataTransfer.setData('text/plain', e.target.dataset.id);
        setTimeout(() => {
            e.target.style.opacity = '0.5';
        }, 0);
    }

    handleDragOver(e) {
        if (this.game.phase !== 'setup') return;
        
        // Allow dropping on a square in the setup zone or the repository
        const square = e.target.closest('.square');
        const repo = e.target.closest('.pieces-repository');
        
        if (repo) {
            e.preventDefault();
        } else if (square) {
            const r = parseInt(square.dataset.row);
            if (r >= 6) { // Setup zone is rows 6 and 7
                e.preventDefault();
            }
        }
    }

    handleDrop(e) {
        e.preventDefault();
        if (!this.draggedElement || this.game.phase !== 'setup') return;

        const square = e.target.closest('.square');
        const repo = e.target.closest('.pieces-repository');

        if (repo) {
            // Remove from board logic
            this.removeFromBoard(this.draggedElement);
            repo.appendChild(this.draggedElement);
        } else if (square) {
            const r = parseInt(square.dataset.row);
            const c = parseInt(square.dataset.col);
            
            if (r >= 6) {
                // If there's already a piece here, swap them
                const existingPiece = square.querySelector('.piece');
                if (existingPiece && existingPiece !== this.draggedElement) {
                    const originalParent = this.draggedElement.parentNode;
                    originalParent.appendChild(existingPiece);
                    this.updateBoardState(existingPiece, originalParent);
                }

                this.removeFromBoard(this.draggedElement);
                square.appendChild(this.draggedElement);
                
                // Add to game logic board state
                this.game.board[r][c] = {
                    owner: 'me',
                    type: this.draggedElement.dataset.type,
                    hasMoved: false
                };
            }
        }
        
        this.checkAllPiecesPlaced();
    }
    
    removeFromBoard(element) {
        const oldSquare = element.closest('.square');
        if (oldSquare) {
            const oldR = parseInt(oldSquare.dataset.row);
            const oldC = parseInt(oldSquare.dataset.col);
            this.game.board[oldR][oldC] = null;
        }
    }
    
    updateBoardState(element, parent) {
        if (parent.classList.contains('square')) {
            const r = parseInt(parent.dataset.row);
            const c = parseInt(parent.dataset.col);
            this.game.board[r][c] = {
                owner: 'me',
                type: element.dataset.type,
                hasMoved: false
            };
        } else {
            this.removeFromBoard(element);
        }
    }

    handleDragEnd(e) {
        if (this.draggedElement) {
            this.draggedElement.style.opacity = '1';
        }
        this.draggedElement = null;
    }

    checkAllPiecesPlaced() {
        const repo = document.getElementById('pieces-repository');
        const btnReady = document.getElementById('btn-ready');
        
        if (repo.children.length === 0) {
            btnReady.disabled = false;
            btnReady.classList.add('btn-primary');
            btnReady.classList.remove('btn-secondary');
        } else {
            btnReady.disabled = true;
            btnReady.classList.add('btn-secondary');
            btnReady.classList.remove('btn-primary');
        }
    }
}
