/**
 * ⚡ SHARED DOMAIN — VETO SEQUENCES (TS)
 */

export const SEQUENCES: Record<string, any[]> = {
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

export const WINGMAN_MAPS = [
    'Vertigo', 'Nuke', 'Inferno', 'Overpass', 'Sanctum', 'Poseidon'
];

export const DEFAULT_MAPS = [
    'Dust2', 'Inferno', 'Mirage', 'Overpass', 'Nuke', 'Anubis', 'Ancient'
];

export function getDefaultMapPool(format: string) {
    if (format && format.startsWith('wingman')) return WINGMAN_MAPS;
    return DEFAULT_MAPS;
}
