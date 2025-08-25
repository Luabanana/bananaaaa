from noise import pnoise2, pnoise3
import random

def generate_world():
    world = {}
    terrain_size = 32
    max_height = 12
    seed = random.randint(0, 1000000)

    def get_biome(x, z):
        biome_value = pnoise2(x * 0.02, z * 0.02, base=seed)
        if biome_value > 0.4:
            return 'mountain'
        if biome_value > -0.1:
            return 'forest'
        return 'plains'

    # Generate terrain
    for x in range(terrain_size):
        for z in range(terrain_size):
            height = int(pnoise2(x * 0.08, z * 0.08, base=seed) * max_height / 2 + max_height / 2)
            biome = get_biome(x, z)

            for y in range(height + 1):
                block_type = 'dirt'
                if y == height:
                    block_type = 'grass'
                elif y < height - 1:
                    block_type = 'coal' if random.random() < 0.15 else 'stone'
                world[f'{x},{y},{z}'] = block_type

            if biome == 'plains' and pnoise2(x * 0.05, z * 0.05, base=seed + 1) < -0.5 and height < 6:
                world[f'{x},{height + 1},{z}'] = 'water'

    # Generate caves
    for x in range(terrain_size):
        for z in range(terrain_size):
            for y in range(max_height):
                if pnoise3(x * 0.15, y * 0.15, z * 0.15, base=seed + 2) > 0.75:
                    key = f'{x},{y},{z}'
                    if key in world:
                        del world[key]

    # Generate trees
    for x in range(1, terrain_size - 1):
        for z in range(1, terrain_size - 1):
            biome = get_biome(x, z)
            if (biome == 'forest' and random.random() < 0.08) or (biome == 'plains' and random.random() < 0.02):
                surface_y = max(
                    int(key.split(',')[1]) for key in world
                    if key.startswith(f'{x},') and key.endswith(f',{z}')
                ) + 1

                trunk_height = random.randint(3, 4)
                for y in range(surface_y, surface_y + trunk_height):
                    world[f'{x},{y},{z}'] = 'dirt'

                foliage_y = surface_y + trunk_height - 1
                for dy in range(2):
                    offset = 1 if dy == 0 else 0
                    for dx in range(-offset, offset + 1):
                        for dz in range(-offset, offset + 1):
                            if random.random() < 0.8:
                                world[f'{x + dx},{foliage_y + dy},{z + dz}'] = 'grass'

    return world