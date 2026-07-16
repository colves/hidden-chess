class PeerConnection {
    constructor(onMessageReceived, onConnectionStatusChanged) {
        this.peer = null;
        this.connection = null;
        this.isHost = false;
        this.onMessageReceived = onMessageReceived;
        this.onConnectionStatusChanged = onConnectionStatusChanged; // Connecting, Connected, Disconnected
    }

    initHost() {
        return new Promise((resolve, reject) => {
            this.isHost = true;
            // Generate a random 6-character alphanumeric code
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const peerOptions = {
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' }
                    ]
                }
            };
            
            this.peer = new Peer('hc-' + code, peerOptions);

            this.peer.on('open', (id) => {
                const displayCode = id.replace('hc-', '');
                resolve(displayCode);
            });

            this.peer.on('connection', (conn) => {
                this.connection = conn;
                this.connection.on('open', () => {
                    this.setupConnection();
                });
            });

            this.peer.on('error', (err) => {
                console.error("PeerJS error:", err);
                reject(err);
            });
        });
    }

    joinGame(code) {
        return new Promise((resolve, reject) => {
            this.isHost = false;
            
            const peerOptions = {
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            };
            
            this.peer = new Peer(peerOptions);

            this.peer.on('open', () => {
                this.connection = this.peer.connect('hc-' + code);
                
                this.connection.on('open', () => {
                    this.setupConnection();
                    resolve(true);
                });

                this.connection.on('error', (err) => {
                    console.error("Connection error:", err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error("PeerJS error:", err);
                reject(err);
            });
        });
    }

    setupConnection() {
        this.onConnectionStatusChanged('Connected');

        this.connection.on('data', (data) => {
            if (this.onMessageReceived) {
                this.onMessageReceived(data);
            }
        });

        this.connection.on('close', () => {
            this.onConnectionStatusChanged('Disconnected');
        });
    }

    sendMessage(type, payload) {
        if (this.connection && this.connection.open) {
            this.connection.send({ type, payload });
        } else {
            console.warn("Cannot send message: Connection not open");
        }
    }

    closeConnection() {
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.connection = null;
        this.peer = null;
    }
}
