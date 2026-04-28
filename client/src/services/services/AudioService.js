/**
 * ⚡ UI LAYER — AUDIO SERVICE
 * =============================================================================
 * Responsibility: Cinematic sound effects for the Veto platform.
 * =============================================================================
 */

const SOUNDS = {
    BAN: 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-click-900.mp3',
    PICK: 'https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3',
    READY: 'https://assets.mixkit.co/sfx/preview/mixkit-positive-interface-beep-221.mp3',
    FINISH: 'https://assets.mixkit.co/sfx/preview/mixkit-completion-of-a-level-2063.mp3',
    TICK: 'https://assets.mixkit.co/sfx/preview/mixkit-clock-tick-tock-986.mp3'
};

class AudioService {
    constructor() {
        this.enabled = true;
        this.cache = {};
        this._preload();
    }

    _preload() {
        if (typeof window === 'undefined') return;
        Object.keys(SOUNDS).forEach(key => {
            const audio = new Audio(SOUNDS[key]);
            audio.preload = 'auto';
            this.cache[key] = audio;
        });
    }

    play(key, volume = 0.5) {
        if (!this.enabled || !this.cache[key]) return;
        try {
            const audio = this.cache[key].cloneNode();
            audio.volume = volume;
            audio.play().catch(() => {
                // Ignore errors if browser blocks autoplay
            });
        } catch (e) {
            console.warn('[AudioService] Playback failed:', e);
        }
    }

    setEnabled(val) {
        this.enabled = val;
    }
}

export default new AudioService();
