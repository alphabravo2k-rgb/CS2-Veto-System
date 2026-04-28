/**
 * ⚡ DOMAIN LAYER — VETO ENGINE (DETERMINISTIC STATE MACHINE)
 * =============================================================================
 * PROBLEM (Architecture Flaw): All veto logic was embedded in the Socket.IO
 * transport layer inside server.js. The state machine was implicit — scattered
 * across socket event handlers with side-effects (timers, DB writes, socket
 * broadcasts) mixed directly into game logic. This made the logic untestable,
 * impossible to audit, and tightly coupled to the transport mechanism.
 *
 * PROBLEM (Fragile Logic — Undo): The undo functionality parsed game state
 * FROM LOG STRINGS (e.g. checking if a log message "includes('[BAN]')"). This
 * is catastrophically fragile — any log format change breaks undo.
 *
 * FIX (REWRITE REQUIRED — ARCHITECTURAL LIMITATION):
 * The VetoEngine is now a pure, stateless class of deterministic state
 * transitions. Every method takes a state object and returns a NEW state
 * object. No I/O, no timers, no sockets. The infra layer (websocket.js) owns
 * all side effects. This makes every transition unit-testable.
 * =============================================================================
 */

'use strict';

const { SEQUENCES } = require('./sequences');

const VALID_SIDES = new Set(['CT', 'T']);

class VetoEngine {
    /**
     * Build the initial veto state from a match configuration.
     * This is the ONLY constructor for veto state — no direct state creation elsewhere.
     *
     * @param {object} config
     * @param {string} config.format         - e.g. 'bo3', 'faceit_bo1'
     * @param {Array}  config.mapPool        - [{ name, customImage }]
     * @param {Array}  [config.customSequence] - Override for 'custom' format
     * @param {boolean} config.useTimer
     * @param {number}  config.timerDuration  - seconds
     * @param {boolean} config.useCoinFlip
     * @returns {object} Initial veto state (immutable-style)
     */
    static initializeVeto({ format, mapPool, customSequence, useTimer, timerDuration, useCoinFlip }) {
        if (!mapPool || mapPool.length === 0) {
            throw new Error('Map pool cannot be empty');
        }

        let sequence;
        if (format === 'custom' && Array.isArray(customSequence) && customSequence.length > 0) {
            sequence = customSequence;
        } else {
            sequence = SEQUENCES[format];
            if (!sequence) throw new Error(`Unknown veto format: ${format}`);
        }

        const maps = mapPool.map(m => ({
            name: String(m.name).trim().slice(0, 50),
            customImage: m.customImage || null,
            status: 'available',  // 'available' | 'banned' | 'picked' | 'decider'
            pickedBy: null,       // 'A' | 'B' | null
            side: null,           // 'CT' | 'T' | 'Knife' | null
            sideChosenBy: null,   // 'A' | 'B' | null
        }));

        return {
            format,
            sequence,
            step: 0,
            maps,
            logs: [],
            finished: false,
            lastPickedMap: null,
            playedMaps: [],
            sideHistory: { A: [], B: [] }, // NEW: Track side choices per team
            useTimer: !!useTimer,
            timerDuration: Number(timerDuration) || 60,
            useCoinFlip: !!useCoinFlip,
            coinFlip: useCoinFlip ? { status: 'waiting_call', winner: null, result: null } : null,
            ready: { A: false, B: false },
            timerEndsAt: null,
        };
    }

    /**
     * Validate whether a team can perform an action at the current step.
     * PURE — no mutation.
     *
     * @param {object} state
     * @param {string} teamKey - 'A' | 'B' | 'admin'
     * @param {string} action  - 'ban' | 'pick' | 'side'
     * @returns {{ valid: boolean, reason?: string, currentStep?: object }}
     */
    static validateTurn(state, teamKey, action) {
        if (state.finished) return { valid: false, reason: 'Match is already finished' };
        if (state.useTimer && (!state.ready.A || !state.ready.B)) {
            return { valid: false, reason: 'Both teams must be ready before the veto starts' };
        }
        if (state.useCoinFlip && (!state.coinFlip || state.coinFlip.status !== 'done')) {
            return { valid: false, reason: 'Coin flip must be completed first' };
        }

        const step = state.sequence[state.step];
        if (!step) return { valid: false, reason: 'No more steps in sequence' };

        // Admins can always act (for override purposes)
        if (teamKey !== 'admin' && step.t !== 'System' && step.t !== teamKey) {
            return { valid: false, reason: `Not your turn. Expected team ${step.t}` };
        }

        return { valid: true, currentStep: step };
    }

    /**
     * Apply a ban action.
     * @param {object} state
     * @param {string} teamKey
     * @param {string} mapName
     * @param {string} teamName - Display name for the log
     * @returns {{ state: object, error?: string }}
     */
    static banMap(state, teamKey, mapName, teamName) {
        const { valid, reason, currentStep } = VetoEngine.validateTurn(state, teamKey, 'ban');
        if (!valid) return { state, error: reason };
        if (currentStep.a !== 'ban') return { state, error: `Expected action: ${currentStep.a}` };

        const mapIdx = state.maps.findIndex(m => m.name === mapName && m.status === 'available');
        if (mapIdx === -1) return { state, error: `Map "${mapName}" is not available` };

        // Immutable-style update using structured clone
        const newState = VetoEngine._clone(state);
        newState.maps[mapIdx].status = 'banned';
        newState.step++;
        newState.logs.push(`[BAN] ${teamName} banned ${mapName}`);

        return { state: VetoEngine.finalizeSeries(newState) };
    }

    /**
     * Apply a pick action.
     * @param {object} state
     * @param {string} teamKey
     * @param {string} mapName
     * @param {string} teamName
     * @returns {{ state: object, error?: string }}
     */
    static pickMap(state, teamKey, mapName, teamName) {
        const { valid, reason, currentStep } = VetoEngine.validateTurn(state, teamKey, 'pick');
        if (!valid) return { state, error: reason };
        if (currentStep.a !== 'pick') return { state, error: `Expected action: ${currentStep.a}` };

        const mapIdx = state.maps.findIndex(m => m.name === mapName && m.status === 'available');
        if (mapIdx === -1) return { state, error: `Map "${mapName}" is not available` };

        const newState = VetoEngine._clone(state);
        newState.maps[mapIdx].status = 'picked';
        newState.maps[mapIdx].pickedBy = currentStep.t;
        newState.lastPickedMap = mapName;
        newState.playedMaps.push(mapName);
        newState.step++;
        newState.logs.push(`[PICK] ${teamName} picked ${mapName}`);

        return { state: VetoEngine.finalizeSeries(newState) };
    }

    /**
     * Apply a side selection.
     * @param {object} state
     * @param {string} teamKey
     * @param {string} side - 'CT' | 'T'
     * @param {string} teamName
     * @returns {{ state: object, error?: string }}
     */
    static pickSide(state, teamKey, side, teamName) {
        if (!VALID_SIDES.has(side)) return { state, error: 'Invalid side. Must be CT or T' };

        const { valid, reason, currentStep } = VetoEngine.validateTurn(state, teamKey, 'side');
        if (!valid) return { state, error: reason };
        if (currentStep.a !== 'side') return { state, error: `Expected action: ${currentStep.a}` };

        // GAP FIX: Validation that a team can't pick the same side twice in a series
        if (state.sideHistory[teamKey].includes(side)) {
            return { state, error: `You have already chosen ${side} in this series. Must choose the opposite.` };
        }

        // Find the map that was just picked (lastPickedMap) or the last available
        const targetMap = state.lastPickedMap
            || (state.maps.find(m => m.status === 'available')?.name);

        if (!targetMap) return { state, error: 'No map available to assign a side to' };

        const mapIdx = state.maps.findIndex(m => m.name === targetMap);
        if (mapIdx === -1) return { state, error: 'Target map not found in pool' };

        const newState = VetoEngine._clone(state);
        newState.maps[mapIdx].side = side;
        newState.maps[mapIdx].sideChosenBy = teamKey;
        newState.sideHistory[teamKey].push(side);
        newState.lastPickedMap = null;
        newState.step++;

        // Append side choice to the previous pick log line if possible
        const lastLog = newState.logs[newState.logs.length - 1];
        if (lastLog && lastLog.includes(`picked ${targetMap}`)) {
            newState.logs[newState.logs.length - 1] = `${lastLog} (${teamName} chose ${side} on ${targetMap})`;
        } else {
            newState.logs.push(`[SIDE] ${teamName} chose ${side} on ${targetMap}`);
        }

        return { state: VetoEngine.finalizeSeries(newState) };
    }

    /**
     * Process coin flip call (Team A calls heads/tails).
     * @param {object} state
     * @param {string} call - 'heads' | 'tails'
     * @param {string} teamAName
     * @returns {{ state: object, result: string, winner: string, error?: string }}
     */
    static coinCall(state, call, teamAName, cryptoRandomInt) {
        if (!state.useCoinFlip || !state.coinFlip || state.coinFlip.status !== 'waiting_call') {
            return { state, error: 'Coin flip not applicable at this time' };
        }

        const result = cryptoRandomInt(0, 2) === 0 ? 'heads' : 'tails';
        const winner = call === result ? 'A' : 'B';

        const newState = VetoEngine._clone(state);
        newState.coinFlip.result = result;
        newState.coinFlip.winner = winner;
        newState.coinFlip.status = 'deciding';
        newState.logs.push(`[COIN] Called ${call.toUpperCase()} → ${result.toUpperCase()}. Winner: ${winner === 'A' ? teamAName : 'Team B'}`);

        return { state: newState, result, winner };
    }

    /**
     * Process coin flip decision (winner chooses 'first' or 'second').
     * @param {object} state
     * @param {string} winner   - 'A' | 'B'
     * @param {string} decision - 'first' | 'second'
     * @param {string} winnerName
     * @returns {{ state: object, error?: string }}
     */
    static coinDecision(state, winner, decision, winnerName) {
        if (!state.useCoinFlip || !state.coinFlip || state.coinFlip.status !== 'deciding') {
            return { state, error: 'No pending coin flip decision' };
        }
        if (state.coinFlip.winner !== winner) {
            return { state, error: 'Only the coin flip winner can make this decision' };
        }

        const newState = VetoEngine._clone(state);

        // If winner chose to go second, swap all sequence team assignments
        const shouldSwap = (winner === 'A' && decision === 'second') ||
                           (winner === 'B' && decision === 'first');

        if (shouldSwap) {
            newState.sequence = newState.sequence.map(step => ({
                ...step,
                t: step.t === 'A' ? 'B' : step.t === 'B' ? 'A' : step.t,
            }));
        }

        newState.coinFlip.status = 'done';
        newState.logs.push(`[COIN] ${winnerName} chose to go ${decision}`);

        return { state: newState };
    }

    /**
     * Mark a team as ready. Starts veto when both are ready.
     * @param {object} state
     * @param {string} teamKey - 'A' | 'B'
     * @param {string} teamName
     * @returns {{ state: object, bothReady: boolean }}
     */
    static setTeamReady(state, teamKey, teamName) {
        if (!state.useTimer) return { state, bothReady: false };
        if (state.ready[teamKey]) return { state, bothReady: state.ready.A && state.ready.B };

        const newState = VetoEngine._clone(state);
        newState.ready[teamKey] = true;
        newState.logs.push(`[READY] ${teamName} is ready`);

        const bothReady = newState.ready.A && newState.ready.B;
        if (bothReady) {
            const coinFlipDone = !newState.useCoinFlip || newState.coinFlip?.status === 'done';
            if (coinFlipDone) newState.logs.push('[SYSTEM] Both teams ready — veto timer started');
        }

        return { state: newState, bothReady };
    }

    /**
     * Handle a timer timeout — auto-perform the current step.
     * Used by the timer infrastructure to resolve stuck turns.
     * @param {object} state
     * @param {string} teamAName
     * @param {string} teamBName
     * @returns {object} New state after auto action
     */
    static handleTimeout(state, teamAName, teamBName) {
        if (state.finished) return state;

        const step = state.sequence[state.step];
        if (!step) return state;

        const teamName = step.t === 'A' ? teamAName : step.t === 'B' ? teamBName : 'System';
        const available = state.maps.filter(m => m.status === 'available');

        if ((step.a === 'ban' || step.a === 'pick') && available.length > 0) {
            const randomMap = available[Math.floor(Math.random() * available.length)];
            const action = step.a === 'ban' ? 'ban' : 'pick';
            const newState = VetoEngine._clone(state);
            const mapIdx = newState.maps.findIndex(m => m.name === randomMap.name);

            if (action === 'ban') {
                newState.maps[mapIdx].status = 'banned';
                newState.step++;
                newState.logs.push(`[AUTO-BAN] ${teamName} → ${randomMap.name} (timeout)`);
            } else {
                newState.maps[mapIdx].status = 'picked';
                newState.maps[mapIdx].pickedBy = step.t;
                newState.lastPickedMap = randomMap.name;
                newState.playedMaps.push(randomMap.name);
                newState.step++;
                newState.logs.push(`[AUTO-PICK] ${teamName} → ${randomMap.name} (timeout)`);
            }

            return VetoEngine.finalizeSeries(newState);
        }

        if (step.a === 'side') {
            const targetMap = state.lastPickedMap || available[0]?.name;
            if (!targetMap) return state;
            const newState = VetoEngine._clone(state);
            const mapIdx = newState.maps.findIndex(m => m.name === targetMap);
            const randomSide = Math.random() > 0.5 ? 'CT' : 'T';
            newState.maps[mapIdx].side = randomSide;
            newState.lastPickedMap = null;
            newState.step++;
            newState.logs.push(`[AUTO-SIDE] ${teamName} → ${randomSide} on ${targetMap} (timeout)`);
            return VetoEngine.finalizeSeries(newState);
        }

        return state;
    }

    /**
     * FIX (Fragile Logic): The original undo parsed LOG STRINGS to determine
     * what to revert. This is broken if log format changes.
     *
     * NEW: Undo stores a full state snapshot in the room's undo stack
     * via the infra layer. This method just validates the request.
     * The infra layer (websocket.js) maintains the undo history using
     * a stack of full state snapshots pushed before every mutation.
     *
     * @param {object[]} undoStack - Array of previous states
     * @returns {{ state: object, error?: string }}
     */
    static undoStep(undoStack) {
        if (!undoStack || undoStack.length === 0) {
            return { error: 'Nothing to undo' };
        }
        const previousState = undoStack[undoStack.length - 1];
        return { state: previousState };
    }

    /**
     * Reset the veto to the initial state (admin action).
     * @param {object} state - Current state
     * @param {string} format
     * @param {Array}  mapPool
     * @returns {object} Fresh initial state
     */
    static resetVeto(state) {
        const freshState = VetoEngine.initializeVeto({
            format: state.format,
            mapPool: state.maps.map(m => ({ name: m.name, customImage: m.customImage })),
            customSequence: null,
            useTimer: state.useTimer,
            timerDuration: state.timerDuration,
            useCoinFlip: state.useCoinFlip,
        });
        freshState.logs = ['[ADMIN] Veto reset by admin'];
        return freshState;
    }

    /**
     * Check if the series is complete and finalize if so.
     * Also handles the 'knife' pseudo-step for decider maps.
     * PURE — safe to call after every state transition.
     *
     * @param {object} state
     * @returns {object} Potentially finalized state
     */
    static finalizeSeries(state) {
        if (state.finished) return state;

        const step = state.sequence[state.step];

        // Handle knife step (decider via system)
        if (step && step.a === 'knife') {
            const decider = state.maps.find(m => m.status === 'available');
            if (decider) {
                const newState = VetoEngine._clone(state);
                const mapIdx = newState.maps.findIndex(m => m.name === decider.name);
                newState.maps[mapIdx].status = 'decider';
                newState.maps[mapIdx].side = 'Knife';
                newState.playedMaps.push(decider.name);
                newState.logs.push(`[DECIDER] ${decider.name} — knife for side`);
                newState.finished = true;
                return newState;
            }
        }

        // Series is done when sequence is exhausted
        if (state.step >= state.sequence.length) {
            const newState = VetoEngine._clone(state);
            const lastAvailable = newState.maps.find(m => m.status === 'available');
            if (lastAvailable) {
                const mapIdx = newState.maps.findIndex(m => m.name === lastAvailable.name);
                newState.maps[mapIdx].status = 'decider';
                newState.playedMaps.push(lastAvailable.name);
            }
            newState.finished = true;
            return newState;
        }

        return state;
    }

    /**
     * Deep-clone a state object for immutable-style transitions.
     * Uses JSON round-trip — safe for all state fields (no functions, no circular refs).
     */
    static _clone(state) {
        return JSON.parse(JSON.stringify(state));
    }
}

module.exports = VetoEngine;
