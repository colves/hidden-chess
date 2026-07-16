// DOM Elements
const screens = {
    main: document.getElementById('main-menu'),
    setup: document.getElementById('host-setup-screen'),
    game: document.getElementById('game-screen')
};

// UI Buttons
const btnCreateGame = document.getElementById('btn-create-game');
const btnJoinGame = document.getElementById('btn-join-game');
const inputJoinCode = document.getElementById('join-code-input');
const btnStartSetup = document.getElementById('btn-start-setup');
const btnReady = document.getElementById('btn-ready');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnLeaveSetup = document.getElementById('btn-leave-setup');
const btnLeaveGame = document.getElementById('btn-leave-game');

// Settings Elements
const setRevealedKings = document.getElementById('setting-revealed-kings');
const setSetupTime = document.getElementById('setting-setup-time');
const setGameTime = document.getElementById('setting-game-time');

// Core components
let peerConnection;
let game;
let dragDropManager;
let settings = {
    revealedKings: false,
    setupTime: 120, // seconds
    gameTime: 0 // seconds, 0 = infinite
};

// Timers
let mainTimerInterval;
let gameTimerMeInterval;
let gameTimerOpponentInterval;
let timeMe = 0;
let timeOpponent = 0;

// Application State
let opponentReady = false;
let meReady = false;
let opponentSetupData = null;

function init() {
    showScreen('main');

    // Button Listeners
    btnCreateGame.addEventListener('click', handleCreateGame);
    btnJoinGame.addEventListener('click', handleJoinGame);
    btnStartSetup.addEventListener('click', goToSetupPhase);
    btnReady.addEventListener('click', handleReady);
    btnCopyCode.addEventListener('click', handleCopyCode);
    btnPlayAgain.addEventListener('click', () => location.reload());
    btnLeaveSetup.addEventListener('click', handleLeaveRoom);
    btnLeaveGame.addEventListener('click', handleLeaveRoom);

    // Game engine init
    game = new Game(
        document.getElementById('chess-board'),
        null, // Will set after connection
        handleGameOver
    );
    dragDropManager = new DragDropManager(game);
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

async function handleCreateGame() {
    btnCreateGame.disabled = true;
    btnCreateGame.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kuruluyor...';
    
    peerConnection = new PeerConnection(onNetworkMessage, onConnectionStatus);
    game.peer = peerConnection;
    
    try {
        const code = await peerConnection.initHost();
        document.getElementById('room-code').innerText = code;
        showScreen('setup');
    } catch (err) {
        alert("Oyun kurulamadı. Lütfen tekrar deneyin.");
        btnCreateGame.disabled = false;
        btnCreateGame.innerHTML = '<i class="fa-solid fa-plus"></i> Oyun Kur';
    }
}

async function handleJoinGame() {
    const code = inputJoinCode.value.trim().toUpperCase();
    if (code.length !== 6) {
        alert("Lütfen 6 haneli geçerli bir oyun kodu girin.");
        return;
    }

    btnJoinGame.disabled = true;
    btnJoinGame.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bağlanıyor...';

    peerConnection = new PeerConnection(onNetworkMessage, onConnectionStatus);
    game.peer = peerConnection;

    try {
        await peerConnection.joinGame(code);
        // Wait for settings from host
        btnJoinGame.innerHTML = 'Bağlandı, Ayarlar Bekleniyor...';
    } catch (err) {
        alert("Bağlantı kurulamadı. Kod yanlış olabilir.");
        btnJoinGame.disabled = false;
        btnJoinGame.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Katıl';
    }
}

function onConnectionStatus(status) {
    const statusEl = document.getElementById('host-status');
    if (status === 'Connected') {
        if (peerConnection.isHost) {
            statusEl.innerText = "Rakip bağlandı! Ayarları seçip devam edebilirsiniz.";
            statusEl.style.color = "var(--accent-secondary)";
            btnStartSetup.disabled = false;
        } else {
            // I am peer, connection is established! Go to lobby.
            showScreen('setup');
            statusEl.innerText = "Kurucunun ayarları yapması ve oyunu başlatması bekleniyor...";
            statusEl.style.color = "var(--accent-secondary)";
            
            // Disable settings and buttons
            setRevealedKings.disabled = true;
            setSetupTime.disabled = true;
            setGameTime.disabled = true;
            btnStartSetup.style.display = 'none';
            document.querySelector('.code-display').style.display = 'none'; // Hide code box for peer
        }
    } else if (status === 'Disconnected') {
        alert("Bağlantı koptu.");
        location.reload();
    }
}

function handleCopyCode() {
    const code = document.getElementById('room-code').innerText;
    navigator.clipboard.writeText(code);
    btnCopyCode.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => {
        btnCopyCode.innerHTML = '<i class="fa-regular fa-copy"></i>';
    }, 2000);
}

// Send settings update to peer whenever host changes them
[setRevealedKings, setSetupTime, setGameTime].forEach(el => {
    el.addEventListener('change', () => {
        if (peerConnection && peerConnection.isHost) {
            settings = {
                revealedKings: setRevealedKings.checked,
                setupTime: parseInt(setSetupTime.value),
                gameTime: parseInt(setGameTime.value)
            };
            peerConnection.sendMessage('SETTINGS_UPDATED', settings);
        }
    });
});

function goToSetupPhase() {
    // Both Host and Peer will transition to the Game screen
    if (peerConnection.isHost) {
        // Double check settings before starting
        settings = {
            revealedKings: setRevealedKings.checked,
            setupTime: parseInt(setSetupTime.value),
            gameTime: parseInt(setGameTime.value)
        };
        peerConnection.sendMessage('START_SETUP', settings);
    }
    
    game.setSettings(settings);
    
    showScreen('game');
    document.getElementById('game-phase-text').innerText = 'Hazırlık Aşaması';
    
    // Init drag drop
    dragDropManager.createInitialPieces(document.getElementById('pieces-repository'));
    game.startSetup();
    
    // Start Setup Timer if not unlimited
    if (settings.setupTime > 0) {
        startMainTimer(settings.setupTime, () => {
            // Force ready if time runs out
            if (!meReady) handleReady();
        });
    } else {
        document.getElementById('main-timer').innerText = 'Sınırsız';
    }
}

function handleLeaveRoom() {
    if (peerConnection) {
        peerConnection.sendMessage('ROOM_CLOSED', {});
        peerConnection.closeConnection();
    }
    location.reload();
}

function handleReady() {
    if (document.getElementById('pieces-repository').children.length > 0) {
        alert("Lütfen tüm taşları tahtaya yerleştirin!");
        return;
    }

    meReady = true;
    btnReady.style.display = 'none';
    document.querySelector('.instruction').innerText = "Rakip bekleniyor...";
    
    game.finishSetup();
    
    checkStartGame();
}

function onNetworkMessage(data) {
    const { type, payload } = data;

    switch (type) {
        case 'START_SETUP':
            settings = payload; // Peer receives final settings
            game.setSettings(settings); // Apply settings before going to setup phase
            goToSetupPhase();
            break;
            
        case 'SETTINGS_UPDATED':
            // Peer updates their UI based on host changes
            if (!peerConnection.isHost) {
                setRevealedKings.checked = payload.revealedKings;
                setSetupTime.value = payload.setupTime;
                setGameTime.value = payload.gameTime;
                settings = payload;
            }
            break;
            
        case 'PLAYER_READY':
            opponentReady = true;
            opponentSetupData = payload.setup;
            checkStartGame();
            break;
            
        case 'MAKE_MOVE':
            game.executeMove(payload.fromR, payload.fromC, payload.toR, payload.toC, true);
            switchTurnsTimer();
            break;
            
        case 'ROOM_CLOSED':
            alert("Rakip odadan çıktı. Oyun sona erdi.");
            if (peerConnection) peerConnection.closeConnection();
            location.reload();
            break;
    }
}

function checkStartGame() {
    if (meReady && opponentReady) {
        startGamePhase();
    }
}

function startGamePhase() {
    clearInterval(mainTimerInterval);
    document.getElementById('setup-controls').style.display = 'none';
    document.getElementById('pieces-repository').style.display = 'none';
    
    // Host starts first
    const isMyTurn = peerConnection.isHost;
    game.startGame(opponentSetupData, isMyTurn);
    
    // Start Game Timers
    timeMe = settings.gameTime;
    timeOpponent = settings.gameTime;
    
    document.getElementById('game-phase-text').innerText = 'Oyun Başladı';
    document.getElementById('main-timer').style.display = 'none'; // Hide main timer, show player timers
    
    if (settings.gameTime > 0) {
        updateTimerDisplay('timer-you', timeMe);
        updateTimerDisplay('timer-opponent', timeOpponent);
        switchTurnsTimer();
    } else {
        document.getElementById('timer-you').innerText = 'Sınırsız';
        document.getElementById('timer-opponent').innerText = 'Sınırsız';
    }
}

function switchTurnsTimer() {
    if (settings.gameTime === 0 || game.phase === 'gameover') return;
    
    clearInterval(gameTimerMeInterval);
    clearInterval(gameTimerOpponentInterval);
    
    if (game.turn === 'me') {
        gameTimerMeInterval = setInterval(() => {
            timeMe--;
            updateTimerDisplay('timer-you', timeMe);
            if (timeMe <= 0) handleGameOver('Rakip (Süre Bitti)');
        }, 1000);
    } else {
        gameTimerOpponentInterval = setInterval(() => {
            timeOpponent--;
            updateTimerDisplay('timer-opponent', timeOpponent);
            if (timeOpponent <= 0) handleGameOver('Siz (Süre Bitti)');
        }, 1000);
    }
}

function startMainTimer(seconds, onComplete) {
    clearInterval(mainTimerInterval);
    
    let timeRemaining = seconds;
    updateTimerDisplay('main-timer', timeRemaining);
    
    mainTimerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay('main-timer', timeRemaining);
        
        if (timeRemaining <= 0) {
            clearInterval(mainTimerInterval);
            if (onComplete) onComplete();
        }
    }, 1000);
}

function updateTimerDisplay(elementId, seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById(elementId).innerText = 
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function handleGameOver(winnerName) {
    clearInterval(gameTimerMeInterval);
    clearInterval(gameTimerOpponentInterval);
    
    const modal = document.getElementById('game-over-modal');
    const msg = document.getElementById('game-over-message');
    
    if (winnerName === 'Siz') {
        msg.innerText = "Tebrikler! Rakibin şahını ele geçirdiniz ve kazandınız!";
    } else if (winnerName.includes('Süre Bitti')) {
        msg.innerText = winnerName === 'Siz (Süre Bitti)' ? 
            "Tebrikler! Rakibin süresi bittiği için kazandınız!" : 
            "Maalesef süreniz bittiği için kaybettiniz.";
    } else {
        msg.innerText = "Maalesef rakip şahınızı ele geçirdi ve kaybettiniz.";
    }
    
    modal.classList.add('active');
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
