const { createNoise2D, createNoise3D } = require('simplex-noise');

function generateWorld() {
    const world = {};
    const terrainSize = 32;
    const noise2D = createNoise2D();
    const noise3D = createNoise3D();
    const maxHeight = 12;

    // Biome noise
    function getBiome(x, z) {
        const biomeValue = noise2D(x * 0.02, z * 0.02);
        if (biomeValue > 0.4) return 'mountain';
        if (biomeValue > -0.1) return 'forest';
        return 'plains';
    }

    // Generate terrain
    for (let x = 0; x < terrainSize; x++) {
        for (let z = 0; z < terrainSize; z++) {
            const height = Math.floor(noise2D(x * 0.08, z * 0.08) * maxHeight / 2 + maxHeight / 2);
            const biome = getBiome(x, z);

            for (let y = 0; y <= height; y++) {
                let blockType = 'dirt';
                if (y === height) blockType = 'grass';
                else if (y < height - 1) blockType = Math.random() < 0.15 ? 'coal' : 'stone';
                world[`${x},${y},${z}`] = blockType;
            }

            // Add water for rivers
            if (biome === 'plains' && noise2D(x * 0.05, z * 0.05) < -0.5 && height < 6) {
                world[`${x},${height + 1},${z}`] = 'water';
            }
        }
    }

    // Generate caves
    for (let x = 0; x < terrainSize; x++) {
        for (let z = 0; z < terrainSize; z++) {
            for (let y = 0; y < maxHeight; y++) {
                if (noise3D(x * 0.15, y * 0.15, z * 0.15) > 0.75) {
                    delete world[`${x},${y},${z}`];
                }
            }
        }
    }

    // Generate trees
    for (let x = 1; x < terrainSize - 1; x++) {
        for (let z = 1; z < terrainSize - 1; z++) {
            const biome = getBiome(x, z);
            if ((biome === 'forest' && Math.random() < 0.08) || (biome === 'plains' && Math.random() < 0.02)) {
                const surfaceY = Math.max(...Object.keys(world)
                    .filter(key => key.startsWith(`${x},`) && key.endsWith(`,${z}`))
                    .map(key => parseInt(key.split(',')[1]))) + 1;

                // Tree trunk
                const trunkHeight = Math.floor(Math.random() * 2) + 3;
                for (let y = surfaceY; y < surfaceY + trunkHeight; y++) {
                    world[`${x},${y},${z}`] = 'dirt';
                }

                // Foliage
                const foliageY = surfaceY + trunkHeight - 1;
                for (let dy = 0; dy < 2; dy++) {
                    const offset = dy === 0 ? 1 : 0;
                    for (let dx = -offset; dx <= offset; dx++) {
                        for (let dz = -offset; dz <= offset; dz++) {
                            if (Math.random() < 0.8) {
                                world[`${x + dx},${foliageY + dy},${z + dz}`] = 'grass';
                            }
                        }
                    }
                }
            }
        }
    }

    return world;
}

module.exports = { generateWorld };