export const getMapNameWithPrefix = (mapName) => {
    if (!mapName) return mapName;
    if (mapName.includes('_')) return mapName.toLowerCase();
    
    const lowerName = mapName.toLowerCase();
    const hostageMaps = ['office', 'assault', 'italy', 'militia'];
    const defusalMaps = ['dust2', 'inferno', 'mirage', 'overpass', 'nuke', 'anubis', 'ancient', 'vertigo', 'cache', 'train', 'cobblestone', 'tuscan', 'sanctum', 'poseidon'];
    
    if (hostageMaps.some(m => lowerName.includes(m))) return `cs_${lowerName}`;
    if (defusalMaps.some(m => lowerName.includes(m))) return `de_${lowerName}`;
    return `de_${lowerName}`;
};

export const getMapImageUrl = (mapName, customImage = null) => {
    if (customImage) return { primary: customImage, fallbacks: [] };
    const baseName = mapName.toLowerCase();
    
    // 🛡️ Priority 1: Locally bundled assets (No dependency risk)
    const localPath = `/maps/${baseName}.jpg`;
    
    // Priority 2: External GitHub Mirror
    const prefixName = getMapNameWithPrefix(mapName).toLowerCase();
    const githubUrl = `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${prefixName}.png`;
    
    return { 
        primary: localPath, 
        fallbacks: [
            githubUrl,
            `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${prefixName}.jpg`, 
            `https://image.gametracker.com/images/maps/160x120/csgo/${prefixName}.jpg`
        ] 
    };
};
