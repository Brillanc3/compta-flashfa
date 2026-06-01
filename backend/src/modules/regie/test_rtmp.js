const net = require('net');

const client = new net.Socket();
client.connect(1935, '127.0.0.1', () => {
    console.log('[TEST] OK : Le port 1935 accepte les connexions locales.');
    client.destroy();
});

client.on('error', (err) => {
    console.error('[TEST] ERROR : Impossible de se connecter au port 1935 en local :', err.message);
});
