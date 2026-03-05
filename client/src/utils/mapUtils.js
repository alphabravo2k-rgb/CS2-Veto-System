// client/src/utils/mapUtils.js

export const getMapNameWithPrefix = (mapName) => {
    if (!mapName) return mapName;
    if (mapName.includes('_')) return mapName.toLowerCase();
    
    const defusalMaps = ['dust2', 'inferno', 'mirage', 'overpass', 'nuke', 'anubis', 'ancient', 'vertigo', 'cache', 'train', 'cobblestone', 'tuscan'];
    const lowerName = mapName.toLowerCase();
    
    if (defusalMaps.some(m => lowerName.includes(m))) return `de_${lowerName}`;
    return `de_${lowerName}`;
};

export const getMapImageUrl = (mapName, customImage = null) => {
    if (customImage) return { primary: customImage, fallbacks: [] };
    
    const baseName = getMapNameWithPrefix(mapName).toLowerCase();
    return { 
        primary: `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.png`, 
        fallbacks: [
            `https://raw.githubusercontent.com/rpkaul/cs-map-images/refs/heads/main/${baseName}.jpg`, 
            `https://image.gametracker.com/images/maps/160x120/csgo/${baseName}.jpg`
        ] 
    };
};
