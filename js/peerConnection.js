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
                        {
                            urls: "turn:openrelay.metered.ca:80",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        },
                        {
                            urls: "turn:openrelay.metered.ca:443",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        },
                        {
                            urls: "turn:openrelay.metered.ca:443?transport=tcp",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        }
                    ]
                }
            };
            
            this.peer = new Peer('hc-' + code, peerOptions);

            const hostTimeout = setTimeout(() => {
                reject(new Error("Bağlantı zaman aşımı. Lütfen Opera VPN'i kapatıp tekrar deneyin."));
            }, 15000);

            this.peer.on('open', (id) => {
                clearTimeout(hostTimeout);
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
                        { urls: 'stun:stun1.l.google.com:19302' },
                        {
                            urls: "turn:openrelay.metered.ca:80",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        },
                        {
                            urls: "turn:openrelay.metered.ca:443",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        },
                        {
                            urls: "turn:openrelay.metered.ca:443?transport=tcp",
                            username: "openrelayproject",
                            credential: "openrelayproject"
                        }
                    ]
                }
            };
            
            this.peer = new Peer(peerOptions);

            const joinTimeout = setTimeout(() => {
                reject(new Error("Bağlantı 15 saniyedir kurulamadı. Opera GX ayarlarınız veya ağınız (VPN/AdBlocker) Peer-to-Peer bağlantıyı engelliyor olabilir. Tarayıcı değiştirmeyi deneyebilirsiniz."));
            }, 15000);

            this.peer.on('open', () => {
                this.connection = this.peer.connect('hc-' + code, { reliable: true });
                
                this.connection.on('open', () => {
                    clearTimeout(joinTimeout);
                    this.setupConnection();
                    resolve(true);
                });

                this.connection.on('error', (err) => {
                    clearTimeout(joinTimeout);
                    console.error("Connection error:", err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                clearTimeout(joinTimeout);
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
