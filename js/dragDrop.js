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

    createInitialPieces(containerElement, isHost) {
        const pieces = [
            'king', 'queen', 
            'rook', 'rook', 
            'bishop', 'bishop', 
            'knight', 'knight',
            'pawn', 'pawn', 'pawn', 'pawn', 
            'pawn', 'pawn', 'pawn', 'pawn'
        ];

        const myColor = isHost ? 'white' : 'black';

        containerElement.innerHTML = '';
        pieces.forEach((type, index) => {
            const piece = document.createElement('div');
            piece.className = 'piece';
            piece.draggable = true;
            piece.dataset.type = type;
            piece.dataset.id = `piece-${index}`;
            piece.innerHTML = this.game.getPieceIcon(type, myColor);
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
                }

                square.appendChild(this.draggedElement);
            }
        }
        
        this.checkAllPiecesPlaced();
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
