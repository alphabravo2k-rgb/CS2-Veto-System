/**
 * 🏆 SHARED DOMAIN — BRACKET GENERATOR (TS)
 */

export class BracketGenerator {
    static generateSingleElimination(teams: any[]) {
        const teamCount = teams.length;
        const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        const roundsCount = Math.log2(nextPowerOfTwo);
        
        const paddedTeams = [...teams];
        while (paddedTeams.length < nextPowerOfTwo) {
            paddedTeams.push({ id: 'bye', name: 'BYE', logo: null });
        }

        const rounds: any[] = [];
        let currentRoundTeams = paddedTeams;

        for (let r = 0; r < roundsCount; r++) {
            const roundMatches: any[] = [];
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
                    matchId: null,
                    nextMatchId: r < roundsCount - 1 ? `r${r+1}-m${Math.floor(i / 2)}` : null,
                    nextMatchPosition: i % 2 === 0 ? 'teamA' : 'teamB'
                });
            }
            
            rounds.push({
                name: r === roundsCount - 1 ? 'Finals' : r === roundsCount - 2 ? 'Semi-Finals' : `Round ${r + 1}`,
                matches: roundMatches
            });

            currentRoundTeams = new Array(nextRoundSize).fill({ id: null, name: 'TBD', logo: null });
        }

        return {
            type: 'single_elimination',
            rounds,
            totalMatches: nextPowerOfTwo - 1
        };
    }
}
