# Terrarium

A tiny living world for your screen. A low-poly island on a diorama stand that
follows the **real sun and seasons** where you are: long golden shadows at dusk,
moonlight and stars at night, red and gold trees in autumn, snow in January.

Where it's going: a universe shaped by the laws of nature and the accidents
that happened to it. Worlds start with hydrogen and gravity. Rare events, like
the impact that made our Moon, happen by fate or when you choose, and when they
happen changes everything after. See [docs/DESIGN.md](docs/DESIGN.md).

## Run it

```bash
npm install
npm run dev
```

Drag to orbit, scroll to zoom. `H` hides the panel, `N` makes a new world.

### URL options

| Option | Example | What it does |
|---|---|---|
| `seed` | `?seed=mehak` | Same seed, same island, for everyone |
| `date` | `?date=2026-12-24T17:00` | Freeze at a moment instead of following the clock |
| `lat`, `lon` | `?lat=43.65&lon=-79.38` | Exact sun position (default: estimated from time zone) |
| `ui=0` | | Hide the panel (clean wallpaper) |
| `rotate=0` | | Stop the slow turn |

## Built with

[three.js](https://threejs.org) for rendering, shadows and tilt-shift,
[simplex-noise](https://github.com/jwagner/simplex-noise.js) for terrain and
[SunCalc](https://github.com/mourner/suncalc) for sun and moon positions.

## Deploy

Deploys to Cloudflare as a Worker with static assets:

```bash
npx vite build && npx wrangler deploy
```

## Contributing

Contributions are welcome. By submitting a contribution, you agree that it is
licensed under GPL-3.0 and that the project owner may also license it under
other terms.

## License

[GPL-3.0](LICENSE). If you distribute a modified Terrarium, its source must be
available under the same license.
