/**
 * ⚡ DOMAIN LAYER — VETO SEQUENCES
 * =============================================================================
 * PROBLEM (Architecture Flaw): All veto sequences were hardcoded inline in
 * server.js, making the domain logic inseparable from the transport layer.
 * Adding a new game format required editing a 900-line server file.
 *
 * FIX: Extracted into the Domain Layer. The veto engine is now a pure module
 * with no I/O dependencies. New games/formats can be added here without
 * touching the server or socket code.
 * =============================================================================
 *
 * Action types: 'ban' | 'pick' | 'side' | 'knife'
 * Team keys:    'A' | 'B' | 'System'
 */

const SEQUENCES = {
    // ── CS2 Standard (VRS) ─────────────────────────────────────────────────
    bo1: [
        { t: 'A', a: 'ban' }, { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' },
        { t: 'B', a: 'ban' }, { t: 'B', a: 'ban' }, { t: 'A', a: 'ban' },
        { t: 'B', a: 'side' }
    ],
    bo3: [
        { t: 'A', a: 'ban'  }, { t: 'B', a: 'ban'  },
        { t: 'A', a: 'pick' }, { t: 'B', a: 'side' },
        { t: 'B', a: 'pick' }, { t: 'A', a: 'side' },
        { t: 'B', a: 'ban'  }, { t: 'A', a: 'ban'  },
        { t: 'B', a: 'side' }
    ],
    bo5: [
        { t: 'A', a: 'ban'  }, { t: 'B', a: 'ban'  },
        { t: 'A', a: 'pick' }, { t: 'B', a: 'side' },
        { t: 'B', a: 'pick' }, { t: 'A', a: 'side' },
        { t: 'A', a: 'pick' }, { t: 'B', a: 'side' },
        { t: 'B', a: 'pick' }, { t: 'A', a: 'side' },
        { t: 'System', a: 'knife' }
    ],

    // ── FACEIT Style ────────────────────────────────────────────────────────
    faceit_bo1: [
        { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' },
        { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' },
        { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' },
        { t: 'System', a: 'knife' }
    ],
    faceit_bo3: [
        { t: 'A', a: 'ban'  }, { t: 'B', a: 'ban'  },
        { t: 'A', a: 'pick' }, { t: 'B', a: 'side' },
        { t: 'B', a: 'pick' }, { t: 'A', a: 'side' },
        { t: 'A', a: 'ban'  }, { t: 'B', a: 'ban'  },
        { t: 'System', a: 'knife' }
    ],
    faceit_bo5: [
        { t: 'A', a: 'ban'  }, { t: 'B', a: 'ban'  },
        { t: 'A', a: 'pick' }, { t: 'B', a: 'side' },
        { t: 'B', a: 'pick' }, { t: 'A', a: 'side' },
        { t: 'A', a: 'pick' }, { t: 'B', a: 'side' },
        { t: 'B', a: 'pick' }, { t: 'A', a: 'side' },
        { t: 'System', a: 'knife' }
    ],

    // ── Wingman ─────────────────────────────────────────────────────────────
    wingman_bo1: [
        { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' },
        { t: 'A', a: 'ban' }, { t: 'B', a: 'ban' },
        { t: 'A', a: 'ban' }, { t: 'System', a: 'knife' }
    ],
    wingman_bo3: [
        { t: 'A', a: 'ban'  }, { t: 'A', a: 'ban'  },
        { t: 'A', a: 'pick' }, { t: 'B', a: 'side' },
        { t: 'B', a: 'pick' }, { t: 'A', a: 'side' },
        { t: 'B', a: 'ban'  }, { t: 'System', a: 'knife' }
    ],
};

const WINGMAN_MAPS = [
    'Vertigo', 'Nuke', 'Inferno', 'Overpass', 'Sanctum', 'Poseidon'
];

const DEFAULT_MAPS = [
    'Dust2', 'Inferno', 'Mirage', 'Overpass', 'Nuke', 'Anubis', 'Ancient'
];

/**
 * Determine the default map pool for a given format.
 * @param {string} format
 * @returns {string[]}
 */
function getDefaultMapPool(format) {
    if (format && format.startsWith('wingman')) return WINGMAN_MAPS;
    return DEFAULT_MAPS;
}

module.exports = { SEQUENCES, WINGMAN_MAPS, DEFAULT_MAPS, getDefaultMapPool };
