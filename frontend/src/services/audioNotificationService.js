// Web Audio API — compatible Chromium 103+
// Sons générés programmatiquement (pas de fichier .mp3 requis)

let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

// Appeler sur click/keydown pour débloquer la politique autoplay
export function unlockAudio() {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        // Joue un silence pour satisfaire le geste utilisateur
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
    } catch { /* intentional */ }
}

// Types : 'message' | 'mention' | 'system'
export function playNotification(type = 'message') {
    // Si dans iframe, déléguer au parent
    if (window !== window.top) {
        try {
            window.top.postMessage({ type: 'AUDIO_NOTIFICATION', notifType: type }, '*');
        } catch { /* intentional */ }
        return;
    }

    try {
        const ctx = getAudioContext();

        const doPlay = () => {
            try {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                const now = ctx.currentTime;

                if (type === 'mention') {
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(880, now);
                    oscillator.frequency.setValueAtTime(1100, now + 0.1);
                    gainNode.gain.setValueAtTime(0.3, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                    oscillator.start(now);
                    oscillator.stop(now + 0.25);
                } else if (type === 'system') {
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(440, now);
                    gainNode.gain.setValueAtTime(0.2, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    oscillator.start(now);
                    oscillator.stop(now + 0.3);
                } else {
                    // 'message' — bip léger
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(660, now);
                    gainNode.gain.setValueAtTime(0.15, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    oscillator.start(now);
                    oscillator.stop(now + 0.15);
                }
            } catch { /* intentional */ }
        };

        if (ctx.state === 'running') {
            doPlay();
        } else {
            // Tente resume() — fonctionne si le navigateur a déjà autorisé ce contexte
            ctx.resume().then(doPlay).catch(() => {});
        }
    } catch { /* intentional */ }
}
