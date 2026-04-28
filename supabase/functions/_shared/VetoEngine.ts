/**
 * ⚡ SHARED DOMAIN — VETO ENGINE (TS/DENO)
 * =============================================================================
 * Deterministic State Machine for CS2 Vetoes.
 * This version is designed to run in Supabase Edge Functions (Deno).
 */

import { SEQUENCES } from './sequences.ts';

const VALID_SIDES = new Set(['CT', 'T']);

export default class VetoEngine {
    /**
     * Build the initial veto state.
     */
    static initializeVeto({ format, mapPool, customSequence, useTimer, timerDuration, useCoinFlip }: any) {
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

        const maps = mapPool.map((m: any) => ({
            name: String(m.name).trim().slice(0, 50),
            customImage: m.customImage || null,
            status: 'available',
            pickedBy: null,
            side: null,
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
            useTimer: !!useTimer,
            timerDuration: Number(timerDuration) || 60,
            useCoinFlip: !!useCoinFlip,
            coinFlip: useCoinFlip ? { status: 'waiting_call', winner: null, result: null } : null,
            ready: { A: false, B: false },
            sideHistory: { A: [], B: [] }, // GAP FIX: Cross-map side tracking
            timerEndsAt: null,
        };
    }

    static validateTurn(state: any, teamKey: string, action: string) {
        if (state.finished) return { valid: false, reason: 'Match is already finished' };
        if (state.useTimer && (!state.ready.A || !state.ready.B)) {
            return { valid: false, reason: 'Both teams must be ready before the veto starts' };
        }
        if (state.useCoinFlip && (!state.coinFlip || state.coinFlip.status !== 'done')) {
            return { valid: false, reason: 'Coin flip must be completed first' };
        }

        const step = state.sequence[state.step];
        if (!step) return { valid: false, reason: 'No more steps in sequence' };

        if (teamKey !== 'admin' && step.t !== 'System' && step.t !== teamKey) {
            return { valid: false, reason: `Not your turn. Expected team ${step.t}` };
        }

        return { valid: true, currentStep: step };
    }

    static banMap(state: any, teamKey: string, mapName: string, teamName: string) {
        const { valid, reason, currentStep } = VetoEngine.validateTurn(state, teamKey, 'ban');
        if (!valid) return { state, error: reason };
        if (currentStep.a !== 'ban') return { state, error: `Expected action: ${currentStep.a}` };

        const mapIdx = state.maps.findIndex((m: any) => m.name === mapName && m.status === 'available');
        if (mapIdx === -1) return { state, error: `Map "${mapName}" is not available` };

        const newState = VetoEngine._clone(state);
        newState.maps[mapIdx].status = 'banned';
        newState.step++;
        newState.logs.push(`[BAN] ${teamName} banned ${mapName}`);

        return { state: VetoEngine.finalizeSeries(newState) };
    }

    static pickMap(state: any, teamKey: string, mapName: string, teamName: string) {
        const { valid, reason, currentStep } = VetoEngine.validateTurn(state, teamKey, 'pick');
        if (!valid) return { state, error: reason };
        if (currentStep.a !== 'pick') return { state, error: `Expected action: ${currentStep.a}` };

        const mapIdx = state.maps.findIndex((m: any) => m.name === mapName && m.status === 'available');
        if (mapIdx === -1) return { state, error: `Map "${mapName}" is not available` };

        const newState = VetoEngine._clone(state);
        newState.maps[mapIdx].status = 'picked';
        newState.maps[mapIdx].pickedBy = (currentStep as any).t;
        newState.lastPickedMap = mapName;
        newState.playedMaps.push(mapName);
        newState.step++;
        newState.logs.push(`[PICK] ${teamName} picked ${mapName}`);

        return { state: VetoEngine.finalizeSeries(newState) };
    }

    static pickSide(state: any, teamKey: string, side: string, teamName: string) {
        if (!VALID_SIDES.has(side)) return { state, error: 'Invalid side. Must be CT or T' };

        const { valid, reason, currentStep } = VetoEngine.validateTurn(state, teamKey, 'side');
        if (!valid) return { state, error: reason };
        if (currentStep.a !== 'side') return { state, error: `Expected action: ${currentStep.a}` };

        // GAP FIX: Side Choice Validation
        if (state.sideHistory?.[teamKey]?.includes(side)) {
            return { state, error: `You have already chosen ${side} in this series. Must choose the opposite.` };
        }

        const targetMap = state.lastPickedMap || (state.maps.find((m: any) => m.status === 'available')?.name);
        if (!targetMap) return { state, error: 'No map available to assign a side to' };

        const mapIdx = state.maps.findIndex((m: any) => m.name === targetMap);
        const newState = VetoEngine._clone(state);
        newState.maps[mapIdx].side = side;
        newState.maps[mapIdx].sideChosenBy = teamKey;
        
        if (!newState.sideHistory) newState.sideHistory = { A: [], B: [] };
        newState.sideHistory[teamKey].push(side);

        newState.lastPickedMap = null;
        newState.step++;

        const lastLog = newState.logs[newState.logs.length - 1];
        if (lastLog && lastLog.includes(`picked ${targetMap}`)) {
            newState.logs[newState.logs.length - 1] = `${lastLog} (${teamName} chose ${side} on ${targetMap})`;
        } else {
            newState.logs.push(`[SIDE] ${teamName} chose ${side} on ${targetMap}`);
        }

        return { state: VetoEngine.finalizeSeries(newState) };
    }

    static setTeamReady(state: any, teamKey: string, teamName: string) {
        if (!state.useTimer) return { state, error: 'Timer is not enabled for this match' };
        if (state.finished) return { state, error: 'Match is already finished' };
        if (teamKey !== 'A' && teamKey !== 'B') return { state, error: 'Only team A or B can set ready status' };

        const newState = VetoEngine._clone(state);
        newState.ready[teamKey] = true;
        newState.logs.push(`[READY] ${teamName} is ready`);

        return { state: newState };
    }

    static coinCall(state: any, call: string, teamAName: string) {
        if (!state.useCoinFlip || !state.coinFlip || state.coinFlip.status !== 'waiting_call') {
            return { state, error: 'Coin flip not applicable at this time' };
        }

        // Deno native CSPRNG
        const randomByte = new Uint8Array(1);
        crypto.getRandomValues(randomByte);
        const result = randomByte[0] % 2 === 0 ? 'heads' : 'tails';
        const winner = call === result ? 'A' : 'B';

        const newState = VetoEngine._clone(state);
        newState.coinFlip.result = result;
        newState.coinFlip.winner = winner;
        newState.coinFlip.status = 'deciding';
        newState.logs.push(`[COIN] Called ${call.toUpperCase()} → ${result.toUpperCase()}. Winner: ${winner === 'A' ? teamAName : 'Team B'}`);

        return { state: newState, result, winner };
    }

    static coinDecision(state: any, winner: string, decision: string, winnerName: string) {
        if (!state.useCoinFlip || !state.coinFlip || state.coinFlip.status !== 'deciding') {
            return { state, error: 'No pending coin flip decision' };
        }
        if (state.coinFlip.winner !== winner) {
            return { state, error: 'Only the coin flip winner can make this decision' };
        }

        const newState = VetoEngine._clone(state);
        const shouldSwap = (winner === 'A' && decision === 'second') || (winner === 'B' && decision === 'first');

        if (shouldSwap) {
            newState.sequence = newState.sequence.map((step: any) => ({
                ...step,
                t: step.t === 'A' ? 'B' : step.t === 'B' ? 'A' : step.t,
            }));
        }

        newState.coinFlip.status = 'done';
        newState.logs.push(`[COIN] ${winnerName} chose to go ${decision}`);

        return { state: newState };
    }

    static finalizeSeries(state: any) {
        if (state.finished) return state;
        const step = state.sequence[state.step];

        if (step && step.a === 'knife') {
            const decider = state.maps.find((m: any) => m.status === 'available');
            if (decider) {
                const newState = VetoEngine._clone(state);
                const mapIdx = newState.maps.findIndex((m: any) => m.name === decider.name);
                newState.maps[mapIdx].status = 'decider';
                newState.maps[mapIdx].side = 'Knife';
                newState.playedMaps.push(decider.name);
                newState.logs.push(`[DECIDER] ${decider.name} — knife for side`);
                newState.finished = true;
                return newState;
            }
        }

        if (state.step >= state.sequence.length) {
            const newState = VetoEngine._clone(state);
            const lastAvailable = newState.maps.find((m: any) => m.status === 'available');
            if (lastAvailable) {
                const mapIdx = newState.maps.findIndex((m: any) => m.name === lastAvailable.name);
                newState.maps[mapIdx].status = 'decider';
                newState.playedMaps.push(lastAvailable.name);
            }
            newState.finished = true;
            return newState;
        }

        return state;
    }

    static revertStep(state: any) {
        if (state.step <= 0) return { state, error: 'Cannot revert initial state' };

        const newState = VetoEngine._clone(state);
        newState.finished = false;
        newState.step--;
        
        const lastAction = newState.sequence[newState.step];
        const lastLog = newState.logs.pop();

        if (lastAction.a === 'ban') {
            const mapMatch = lastLog.match(/banned (.*)/);
            if (mapMatch) {
                const mapName = mapMatch[1];
                const mIdx = newState.maps.findIndex((m: any) => m.name === mapName);
                if (mIdx !== -1) newState.maps[mIdx].status = 'available';
            }
        } else if (lastAction.a === 'pick') {
            const mapMatch = lastLog.match(/picked (.*)/);
            if (mapMatch) {
                const mapName = mapMatch[1].split(' (')[0]; // Handle side choice append
                const mIdx = newState.maps.findIndex((m: any) => m.name === mapName);
                if (mIdx !== -1) {
                    newState.maps[mIdx].status = 'available';
                    newState.maps[mIdx].pickedBy = null;
                    newState.maps[mIdx].side = null;
                    newState.playedMaps = newState.playedMaps.filter((m: string) => m !== mapName);
                }
            }
        } else if (lastAction.a === 'side') {
            const mIdx = newState.maps.findIndex((m: any) => m.side && m.side !== 'Knife');
            if (mIdx !== -1) {
                newState.maps[mIdx].side = null;
                newState.maps[mIdx].sideChosenBy = null;
            }
            // If it's a BO1 decider knife, we might need to handle differently, but standard sequence is side.
        }

        // Cleanup decider if it was set
        newState.maps.forEach((m: any) => {
            if (m.status === 'decider') {
                m.status = 'available';
                m.side = null;
                newState.playedMaps = newState.playedMaps.filter((pm: string) => pm !== m.name);
            }
        });

        return { state: newState };
    }

    static timeout(state: any, teamA: string, teamB: string) {
        const { valid, reason, currentStep } = VetoEngine.validateTurn(state, 'admin', 'timeout');
        if (!valid) return { state, error: reason };

        const availableMaps = state.maps.filter((m: any) => m.status === 'available');
        if (availableMaps.length === 0) return { state, error: 'No maps available for timeout' };

        const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)].name;
        const teamName = currentStep.t === 'A' ? teamA : teamB;

        if (currentStep.a === 'ban') {
            return VetoEngine.banMap(state, currentStep.t, randomMap, `${teamName} (AUTO)`);
        } else if (currentStep.a === 'pick') {
            return VetoEngine.pickMap(state, currentStep.t, randomMap, `${teamName} (AUTO)`);
        } else if (currentStep.a === 'side') {
            const randomSide = Math.random() > 0.5 ? 'CT' : 'T';
            return VetoEngine.pickSide(state, currentStep.t, randomSide, `${teamName} (AUTO)`);
        }

        return { state, error: `Auto-action not implemented for ${currentStep.a}` };
    }

    static _clone(state: any) {
        return structuredClone(state);
    }
}
