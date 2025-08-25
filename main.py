from direct.showbase.ShowBase import ShowBase
from direct.gui.OnscreenText import OnscreenText
from direct.gui.OnscreenImage import OnscreenImage
from panda3d.core import Point3, Vec3, LPoint3f, LVector3f, GeomNode, TransparencyAttrib
from panda3d.core import WindowProperties, MouseButton, KeyboardButton
from panda3d.core import CollisionTraverser, CollisionNode, CollisionBox, CollisionRay, CollisionHandlerQueue
from worldgen import generate_world
import sys
import math

class SandboxGame(ShowBase):
    def __init__(self):
        ShowBase.__init__(self)
        self.disable_mouse()  # Disable default camera controls
        self.set_background_color(0, 0, 0, 1)

        # World and rendering
        self.world = generate_world()
        self.block_nodes = {}
        self.render_distance = 12
        self.max_height = 12

        # Player properties
        self.player_pos = LPoint3f(16, 8, 16)
        self.player_velocity = LVector3f(0, 0, 0)
        self.player_height = 1.8
        self.player_width = 0.6
        self.eye_level = 1.62
        self.base_speed = 0.06
        self.sprint_multiplier = 1.5
        self.jump_strength = 0.18
        self.gravity = 0.004
        self.friction = 0.85
        self.acceleration = 0.005
        self.is_sprinting = False

        # Camera setup
        self.camera.set_pos(self.player_pos)
        self.camera.set_hpr(0, 0, 0)
        self.pitch = 0
        self.heading = 0
        self.mouse_sensitivity = 0.2

        # Block types
        self.block_types = ['grass', 'dirt', 'stone', 'coal']
        self.selected_block = 'grass'
        self.hotbar_index = 0

        # UI
        self.setup_ui()

        # Input handling
        self.accept('w', self.set_key, ['forward', True])
        self.accept('w-up', self.set_key, ['forward', False])
        self.accept('s', self.set_key, ['backward', True])
        self.accept('s-up', self.set_key, ['backward', False])
        self.accept('a', self.set_key, ['left', True])
        self.accept('a-up', self.set_key, ['left', False])
        self.accept('d', self.set_key, ['right', True])
        self.accept('d-up', self.set_key, ['right', False])
        self.accept('space', self.jump)
        self.accept('lshift', self.set_key, ['sprint', True])
        self.accept('lshift-up', self.set_key, ['sprint', False])
        self.accept('mouse1', self.break_block)
        self.accept('mouse3', self.place_block)
        for i in range(4):
            self.accept(str(i + 1), self.select_block, [i])

        # Keys state
        self.keys = {'forward': False, 'backward': False, 'left': False, 'right': False, 'sprint': False}

        # Collision setup
        self.cTrav = CollisionTraverser()
        self.queue = CollisionHandlerQueue()
        self.setup_collisions()

        # Render initial world
        self.update_visible_blocks()

        # Update task
        self.task_mgr.add(self.update, 'update')

    def setup_ui(self):
        # Crosshair
        OnscreenImage(image='crosshair.png', pos=(0, 0, 0), scale=0.02)

        # Info text
        OnscreenText(
            text='WASD: Move | Space: Jump | Shift: Sprint | LClick: Break | RClick: Place | 1-4: Select Block',
            pos=(-1.3, 0.9), fg=(1, 1, 1, 1), bg=(0, 0, 0, 0.8), scale=0.05, align=0
        )

        # Sprint status
        self.sprint_text = OnscreenText(
            text='Sprinting', pos=(-1.3, 0.8), fg=(0, 1, 0, 1), bg=(0, 0, 0, 0.8), scale=0.04, align=0
        )
        self.sprint_text.hide()

        # Hotbar
        self.hotbar_texts = []
        for i, block in enumerate(self.block_types):
            text = OnscreenText(
                text=block.capitalize(), pos=(-0.15 + i * 0.1, -0.9), fg=(1, 1, 1, 1),
                bg=(0.5 if i == 0 else 0.2, 0.2, 0.2, 0.9), scale=0.04, align=0
            )
            self.hotbar_texts.append(text)

    def setup_collisions(self):
        # Player collision box
        player_collider = CollisionNode('player')
        player_collider.add_solid(CollisionBox(
            Point3(-self.player_width / 2, 0, -self.player_width / 2),
            Point3(self.player_width / 2, self.player_height, self.player_width / 2)
        ))
        self.player_coll_np = self.render.attach_new_node(player_collider)
        self.player_coll_np.set_pos(self.player_pos.x, self.player_pos.y - self.eye_level, self.player_pos.z)

        # Ray for block interaction
        self.ray = CollisionRay()
        self.ray_collider = CollisionNode('ray')
        self.ray_collider.add_solid(self.ray)
        self.ray_collider.set_from_collide_mask(1)
        self.ray_collider.set_into_collide_mask(0)
        self.ray_np = self.render.attach_new_node(self.ray_collider)
        self.cTrav.add_collider(self.ray_np, self.queue)

    def set_key(self, key, value):
        self.keys[key] = value
        if key == 'sprint':
            self.is_sprinting = value
            if value:
                self.sprint_text.show()
            else:
                self.sprint_text.hide()

    def jump(self):
        if self.player_velocity.y == 0:
            self.player_velocity.y = self.jump_strength

    def select_block(self, index):
        self.hotbar_index = index
        self.selected_block = self.block_types[index]
        for i, text in enumerate(self.hotbar_texts):
            text['bg'] = (0.5 if i == index else 0.2, 0.2, 0.2, 0.9)

    def update_visible_blocks(self):
        cx, cz = int(self.player_pos.x), int(self.player_pos.z)
        for key in list(self.block_nodes):
            x, y, z = map(int, key.split(','))
            if abs(x - cx) > self.render_distance or abs(z - cz) > self.render_distance:
                self.block_nodes[key].remove_node()
                del self.block_nodes[key]

        for key, block_type in self.world.items():
            x, y, z = map(int, key.split(','))
            if abs(x - cx) <= self.render_distance and abs(z - cz) <= self.render_distance:
                if key not in self.block_nodes:
                    node = self.render.attach_new_node(GeomNode('block'))
                    cube = self.loader.load_model('models/box')
                    cube.set_scale(1)
                    cube.set_pos(x + 0.5, y, z + 0.5)
                    color = {'grass': (0.13, 0.55, 0.13), 'dirt': (0.55, 0.27, 0.07),
                             'stone': (0.75, 0.75, 0.75), 'coal': (0.2, 0.2, 0.2),
                             'water': (0.12, 0.56, 1, 0.7)}[block_type]
                    cube.set_color(*color)
                    if block_type == 'water':
                        cube.set_transparency(TransparencyAttrib.M_alpha)
                    cube.reparent_to(node)
                    self.block_nodes[key] = node

                    # Add collision
                    coll_node = CollisionNode(f'block_{key}')
                    coll_node.add_solid(CollisionBox(Point3(0.5, 0.5, 0.5), 0.5, 0.5, 0.5))
                    coll_np = node.attach_new_node(coll_node)
                    coll_np.set_pos(0, 0, 0)

    def break_block(self):
        self.ray.set_from_lens(self.camera.node(), 0, 0)
        self.cTrav.traverse(self.render)
        if self.queue.get_num_entries() > 0:
            self.queue.sort_entries()
            entry = self.queue.get_entry(0)
            hit_pos = entry.get_surface_point(self.render)
            x, y, z = int(hit_pos.x), int(hit_pos.y), int(hit_pos.z)
            key = f'{x},{y},{z}'
            if key in self.world:
                self.block_nodes[key].remove_node()
                del self.block_nodes[key]
                del self.world[key]

    def place_block(self):
        self.ray.set_from_lens(self.camera.node(), 0, 0)
        self.cTrav.traverse(self.render)
        if self.queue.get_num_entries() > 0:
            self.queue.sort_entries()
            entry = self.queue.get_entry(0)
            hit_pos = entry.get_surface_point(self.render)
            normal = entry.get_surface_normal(self.render)
            x, y, z = int(hit_pos.x + normal.x), int(hit_pos.y + normal.y), int(hit_pos.z + normal.z)
            key = f'{x},{y},{z}'
            player_box = {
                'min': (self.player_pos.x - self.player_width / 2, self.player_pos.y - self.eye_level, self.player_pos.z - self.player_width / 2),
                'max': (self.player_pos.x + self.player_width / 2, self.player_pos.y - self.eye_level + self.player_height, self.player_pos.z + self.player_width / 2)
            }
            block_box = {'min': (x, y, z), 'max': (x + 1, y + 1, z + 1)}
            if not (player_box['min'][0] < block_box['max'][0] and player_box['max'][0] > block_box['min'][0] and
                    player_box['min'][1] < block_box['max'][1] and player_box['max'][1] > block_box['min'][1] and
                    player_box['min'][2] < block_box['max'][2] and player_box['max'][2] > block_box['min'][2]):
                self.world[key] = self.selected_block
                self.update_visible_blocks()

    def update(self, task):
        dt = globalClock.get_dt()

        # Mouse look
        if self.mouseWatcherNode.has_mouse():
            mouse = self.mouseWatcherNode.get_mouse()
            dx = mouse.get_x() * 100
            dy = mouse.get_y() * 100
            self.heading -= dx * self.mouse_sensitivity * dt
            self.pitch -= dy * self.mouse_sensitivity * dt
            self.pitch = max(-85, min(85, self.pitch))
            self.camera.set_hpr(self.heading, self.pitch, 0)
            self.win.move_pointer(0, int(self.win.get_x_size() / 2), int(self.win.get_y_size() / 2))

        # Movement
        direction = LVector3f(0, 0, 0)
        if self.keys['forward']:
            direction += self.camera.get_quat().get_forward()
        if self.keys['backward']:
            direction -= self.camera.get_quat().get_forward()
        if self.keys['right']:
            direction += self.camera.get_quat().get_right()
        if self.keys['left']:
            direction -= self.camera.get_quat().get_right()
        direction.y = 0
        if direction.length() > 0:
            direction.normalize()

        speed = self.base_speed * (self.sprint_multiplier if self.is_sprinting else 1)
        self.player_velocity.x += direction.x * self.acceleration * dt * 60
        self.player_velocity.z += direction.z * self.acceleration * dt * 60
        self.player_velocity.x *= self.friction
        self.player_velocity.z *= self.friction
        self.player_velocity.y -= self.gravity * dt * 60

        horizontal_speed = math.sqrt(self.player_velocity.x**2 + self.player_velocity.z**2)
        if horizontal_speed > speed:
            scale = speed / horizontal_speed
            self.player_velocity.x *= scale
            self.player_velocity.z *= scale

        new_pos = self.player_pos + self.player_velocity * dt * 60
        can_move = True
        step_y = 0

        player_box = {
            'min': (new_pos.x - self.player_width / 2, new_pos.y - self.eye_level, new_pos.z - self.player_width / 2),
            'max': (new_pos.x + self.player_width / 2, new_pos.y - self.eye_level + self.player_height, new_pos.z + self.player_width / 2)
        }

        for key in self.world:
            x, y, z = map(int, key.split(','))
            block_box = {'min': (x, y, z), 'max': (x + 1, y + 1, z + 1)}
            if (player_box['min'][0] < block_box['max'][0] and player_box['max'][0] > block_box['min'][0] and
                player_box['min'][1] < block_box['max'][1] and player_box['max'][1] > block_box['min'][1] and
                player_box['min'][2] < block_box['max'][2] and player_box['max'][2] > block_box['min'][2]):
                if y + 1 <= new_pos.y - self.eye_level + 0.5:
                    step_y = max(step_y, y + 1 - (new_pos.y - self.eye_level))
                else:
                    can_move = False
                    break

        if can_move:
            new_pos.y += step_y
            self.player_pos = new_pos
        else:
            self.player_velocity.x = self.player_velocity.z = 0

        if self.player_pos.y < self.eye_level:
            self.player_pos.y = self.eye_level
            self.player_velocity.y = 0

        self.camera.set_pos(self.player_pos)
        self.player_coll_np.set_pos(self.player_pos.x, self.player_pos.y - self.eye_level, self.player_pos.z)
        self.update_visible_blocks()

        return task.cont

app = SandboxGame()
app.run()