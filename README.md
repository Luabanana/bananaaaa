# 3D AI Arena (Node + Three.js, no bundler)

Een simpele 3D-wereld met WASD + muis (Pointer Lock) en AI-vijanden met levels.

## Snel starten
```bash
npm install
npm start
# open http://localhost:3000
```

## Belangrijk
- Three.js wordt via `<script>`-tags van unpkg geladen → je hebt **geen bundler** nodig en ook geen `import "three"` in je code.
- Klik op **Start** (of ergens in het canvas) om te beginnen; dit activeert **pointer lock**.
- Enter werkt ook om te starten, maar sommige browsers eisen een muisklik voor pointer lock.
