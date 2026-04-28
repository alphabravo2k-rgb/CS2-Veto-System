/**
 * 🏆 DOMAIN LAYER — BRACKET GENERATOR
 * =============================================================================
 * Responsibility: Generate standard esports bracket structures (Single/Double).
 * =============================================================================
 */

class BracketGenerator {
    /**
     * Generate a Single Elimination bracket.
     * @param {Array} teams - List of team objects { id, name, logo }
     * @returns {Object} - Bracket structure with nodes and rounds
     */
    static generateSingleElimination(teams) {
        const teamCount = teams.length;
        const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        const roundsCount = Math.log2(nextPowerOfTwo);
        
        // 1. Prepare Padded Teams (add Byes)
        const paddedTeams = [...teams];
        while (paddedTeams.length < nextPowerOfTwo) {
            paddedTeams.push({ id: 'bye', name: 'BYE', logo: null });
        }

        // 2. Generate Rounds
        const rounds = [];
        let currentRoundTeams = paddedTeams;

        for (let r = 0; r < roundsCount; r++) {
            const roundMatches = [];
            const nextRoundSize = currentRoundTeams.length / 2;
            
            for (let i = 0; i < nextRoundSize; i++) {
                const teamA = currentRoundTeams[i * 2];
                const teamB = currentRoundTeams[i * 2 + 1];
                
                roundMatches.push({
                    id: `r${r}-m${i}`,
                    round: r,
                    index: i,
                    teamA,
                    teamB,
                    winner: null,
                    matchId: null, // Will be linked to a veto_session
                    nextMatchId: r < roundsCount - 1 ? `r${r+1}-m${Math.floor(i / 2)}` : null,
                    nextMatchPosition: i % 2 === 0 ? 'teamA' : 'teamB'
                });
            }
            
            rounds.push({
                name: r === roundsCount - 1 ? 'Finals' : r === roundsCount - 2 ? 'Semi-Finals' : `Round ${r + 1}`,
                matches: roundMatches
            });

            // Prepare next round (empty slots)
            currentRoundTeams = new Array(nextRoundSize).fill({ id: null, name: 'TBD', logo: null });
        }

        return {
            type: 'single_elimination',
            rounds,
            totalMatches: nextPowerOfTwo - 1
        };
    }
}

module.exports = BracketGenerator;
