# Terrarium — Design

> A universe shaped by the laws of nature and the accidents that happened to it.

Status: draft v2 · 2026-11-01

---

## 1. The idea

Every god game gives the player **powers**. Terrarium gives the player
**accidents**.

The laws of nature are always there: gravity, fusion, chemistry, heat, weather.
What makes a world special is the rare events that happened to it by chance:
a planet-sized impact that made a moon, icy asteroids that brought oceans, one
cell swallowing another and starting all complex life. Without them, a world
follows the same laws and turns out completely different.

A world starts at the very beginning, with hydrogen, helium and almost nothing
else, and grows forever using only what it has. Each accident has a **window**
in the world's history when it can happen. The player can make it happen, at a
time they choose, or leave it to **fate**, which rolls the dice. When the
accident happens, and what the world was like at that moment, decides what
comes next.

Every world is an experiment. *What does a planet become without a moon?
Without plate tectonics? If water arrived too early?*

## 2. Principles

1. **Real laws, game resolution.** We use the real equations (conservation of
   mass and energy, Navier–Stokes, the heat equation) on coarse grids. The laws
   are true; only the level of detail is lower.
2. **Nothing from nowhere.** Every resource is conserved. Water, energy and
   elements move between places and forms but are never created or deleted
   except by a law or an accident that really does that.
3. **The world only has what it has.** Resources come from the simulation and
   from accidents, never from a shop.
4. **The inclusion rule.** A piece of science (law or accident) gets in only if
   it changes something the player can see, or something life must adapt to.
5. **No scripted drama.** Storms, extinctions and new species come out of the
   simulation. Accidents are rolled by fate or triggered by the player, never
   scripted.
6. **History only moves forward.** Nothing is erased. Undo is short and
   limited; anything bigger creates a new branch and keeps the old world.
7. **Impossible by nature, never by rule.** The game doesn't forbid things.
   When something can't happen, it's because the world lacks what nature
   needs, and the game says what.
8. **The world keeps living.** Time runs while you're away, fast enough that
   something new has always happened.

## 3. Laws and accidents

| | Laws | Accidents |
|---|---|---|
| What | How nature behaves | Rare events that happen by chance |
| Examples | Gravity, fusion, chemistry, heat, weather | Moon-forming impact, water from space, life starting |
| Present | Always (once their era is reached) | Only if they happen in their window |
| Player | Can't turn them off | Trigger them, or leave them to fate |

An accident can **bring laws with it**. *Water from space* delivers water, and
from then on the **Water module** runs in that world: oceans, rain, rivers,
ice. *Life starts* brings the biology modules. A world where the accident
never happens never gets those behaviours.

## 4. Eras

You can't simulate atoms and islands at the same scale, so a world passes
through eras. Each era runs its own simulation at its own scale and hands its
**results** to the next.

| Era | What happens | Laws | Hands forward |
|---|---|---|---|
| 1. Cosmic dawn | Hydrogen and helium clouds clump | Gravity | Where stars form, how big they are |
| 2. First stars | Stars ignite, fuse, explode | Fusion, stellar life cycle | Element abundances (C, O, Fe, Si…) |
| 3. Planet birth | Gas and dust disc forms planets | Accretion, chemistry | Planet mass, composition, orbit |
| 4. Young planet | Core forms, volcanoes, crust | Geology, magnetism, outgassing | Atmosphere, magnetic shield, land |
| 5. Surface | Oceans, weather, rivers | Thermodynamics, fluids (+ water if it arrived) | Climate, coastlines, soil |
| 6. Life | Chemistry → cells → creatures | Biology, genetics, evolution (if life started) | Living world |

The world is a **whole planet**, not a fixed island. Land is something the
world makes (volcanoes, cooling crust, plates, erosion), so some worlds get a
supercontinent, some scattered islands, some almost all ocean, and a world
without the water accident is all desert. (In the first planet build, land
still comes from noise; the simulation replaces it later.)

## 5. The accident catalogue

Each accident is listed with its era, what it needs, and what a world without
it looks like. "Hypothesis" marks events science still debates; they're
included because they make the world more interesting, and the game says so.

### Universe and star
| Accident | Needs | Without it |
|---|---|---|
| Matter beats antimatter | — | A universe of light only (used for "what if" worlds, not normal play) |
| Nearby supernova triggers the Sun *(hypothesis)* | A massive star nearby | The star forms later or differently |
| A single, calm star | — | Flares or a twin star; harsher, less stable climates |

### Planet birth
| Accident | Needs | Without it |
|---|---|---|
| Giant planet wanders (Grand Tack, *hypothesis*) | A giant planet | Super-Earths crowd the inner system |
| Water from space | Icy bodies in the system | A dry world |
| Moon-forming impact (Theia) | A Mars-sized body nearby | No moon: small tides, wobbling tilt, chaotic seasons |
| The right size | — | Too small (loses its air) or a gas giant |

### Young planet
| Accident | Needs | Without it |
|---|---|---|
| Iron core and magnetic field | Enough iron (from Era 2) | The solar wind strips the atmosphere |
| Plate tectonics | Water in the rocks, the right size | No carbon recycling: runaway heat or deep freeze |
| A stable tilt | A large moon | No seasons, or wild climate swings |

### Life
| Accident | Needs | Without it |
|---|---|---|
| Life starts | Liquid water, chemistry | A sterile world |
| Oxygen photosynthesis | Life | No oxygen, no ozone, no large animals |
| Great Oxidation | Oxygen photosynthesis | Life stays microbial |
| A cell swallows a bacterium (mitochondria) | Life, oxygen | Microbes only, forever |
| Plants get chloroplasts | Complex cells | No green plants |
| Snowball Earth thaws | A frozen world, volcanoes | Frozen forever, or no explosion of animal life |
| Life leaves the sea | Land, ozone | Empty continents |
| A dominant species falls to an asteroid | A ruling species, a big impactor | The rulers stay; others never rise |
| Intelligence | Complex animals | Nobody to see the world |

First accidents to build: **water from space**, **moon-forming impact**,
**life starts**, **the asteroid**.

## 6. How an accident works

### 6.1 Window

Every accident has a **window**: the stretch of world history when it can
happen at all. Before it opens, the conditions don't exist yet. After it
closes, they never will again (for example, the big bodies that could form a
moon have all collided or been thrown out).

### 6.2 Fate

During its window, each accident has a **natural chance** of happening on its
own, rolled by the world's fate, like a dice roll.

- Fate is seeded, so the same world always has the same fate unless something
  changes it (see section 8).
- Fate can also roll **alternatives**: instead of a moon-forming impact, a
  smaller impact gives a tiny moon, or a passing body is captured.
- A player who never touches anything still gets a complete world with its own
  history.
- **Odds are tuned for play, not copied from reality.** Some real accidents
  happened once in 4 billion years, and nobody knows the true odds of life
  starting. Real odds would leave almost every world microbial forever. The
  odds are set so most worlds see some drama and a few stay strange (no moon,
  no complex life). The odds are open to tuning and are listed in the
  game's data, not hidden in code.

### 6.3 The player's trigger

During the window, the player can make the accident happen **now**, instead of
waiting for fate.

### 6.4 Timing changes the outcome

What an accident does depends on the world **at that moment**.

| Accident | Too early | Right time | Too late |
|---|---|---|---|
| Water from space | Planet still molten: water boils off into space | Crust has cooled: oceans form | Little ice left: a shallow sea |
| Moon-forming impact | Molten planet absorbs it: big moon, short days | Earth-like moon | Fewer big bodies left: small moon or none |
| Asteroid | Wipes out simple life, which recovers | Kills the ruling species; another rises | Hits a rich world: mass extinction, then a new era |

### 6.5 Needs (the accident tree)

Some accidents need earlier ones (life needs water). The upgrade screen shows a
**tree of accidents**:

- **Possible now:** inside its window, needs met.
- **Not yet:** greyed, with the reason in plain words.
  *"Life starts: needs liquid water. Your world has none yet."*
- **Missed:** its window has closed. Shown in the tree, permanently locked in
  this world.

The player may **try** an accident whose needs aren't met. Nature answers,
and nothing is lost:

> *An asteroid on a lifeless world: a crater, nothing more.*
> *Starting life on a dry world: "The spark found no water."*

A failed try costs nothing, isn't counted as an upgrade and doesn't use the
undo window. The player can also wait: fate may still bring the missing step
during its window.

### 6.6 Accident = event + modules

When an accident happens, its event plays (the impact, the arrival) and the
modules it brings start running. Modules follow the contract in section 9.

## 7. Undo (accidents the player triggered)

```
possible → triggered (undo window, 48 h) → permanent
                    │
                    └─ undo → never happened
```

- For **2 real days** after triggering an accident, the player can undo it.
  After that it is **permanent**.
- **Undo = revert.** The world returns to the exact moment before the
  accident, as if it never happened. Everything since is lost (the confirm
  screen says so).
- **Snapshot on trigger.** Triggering saves a full snapshot of the world, kept
  for the 48 h window, then deleted.
- **Undo is stacked.** Undoing an accident also undoes every accident triggered
  after it. The confirm screen lists them.
- **Fate's accidents can't be undone.** They're the world's own history.
- After an undo, the accident's window may still be open: the player can
  trigger it again later, or leave it to fate.

## 8. When a player isn't happy with their world

**Missed accidents stay locked in that world, forever.** The player has
these choices:

| Choice | What it does | Old world |
|---|---|---|
| **Keep going** (default) | Live with the world's fate | Stays as it is |
| **Branch** | Recreate the world exactly as it was just before the first missed accident's window, and continue from there | Kept in the gallery |
| **Guided world** | A new world where every accident happened at the right time, starting at the era of the first missed accident (not where the player is now) | Kept in the gallery |
| **Fresh start** | A brand-new seed from the very beginning | Kept in the gallery |

### 8.1 Limits and fate

- **Branches and guided worlds are limited.** Starting values, tunable:
  **1 branch per world** and **1 guided world per player at a time**. Fresh
  starts are unlimited.
- **A branch re-rolls fate.** The world is recreated exactly up to the branch
  point, but fate rolls new dice from there. A branch is a second chance, not
  a guaranteed fix: the missed accident is possible again, but fate (or the
  player's timing) still decides how it goes.
- **The cost matches the mistake.** Missing an early accident means branching
  from far back and losing a lot of history; missing a recent one costs little.

### 8.2 The gallery

No world is ever destroyed. Every world a player leaves is kept as it was:
viewable, replayable from its beginning (section 10) and shareable. Strange
worlds, like one that never got a moon, are often the most interesting to
share.

## 9. World model and modules

- **Fields:** the world is a set of shared grids: temperature, water (by phase),
  air pressure and wind, elevation, soil, light, element amounts, and later
  biomass and creatures. Each era has its own grids and scale.
- **Resources:** totals of each element and of energy, tracked per world.
  They change only through laws and accidents.
- **Ledger:** a world's history is stored as its seed, law versions, the
  accidents that happened (by fate or player, with timestamps) and branch
  points. Because the simulation is deterministic, the ledger is enough to
  recreate any moment.

Each law is a **module**: a self-contained piece of code with a fixed contract.

```
id, version         e.g. "water", 1.2.0
brought by          the accident that starts it (or "always" for base laws)
reads / writes      the fields it uses and changes
conserves           what it must keep balanced (water mass, energy…)
step(world, dt)     advance the world by dt
budget              maximum cost per step
```

Each accident is a **definition** with its window, needs, odds, alternatives,
timing-dependent outcomes and the modules it brings.

### Acceptance checks (automatic, on every pull request)

1. **Conservation:** totals of everything it declares stay balanced to within
   tolerance over a long run.
2. **Stability:** a set of reference worlds runs 100 simulated years without
   values blowing up or every living thing dying for no physical reason.
3. **Budget:** it stays within its time and memory budget.
4. **Determinism:** the same inputs give bit-for-bit the same output.
5. **Visible effect:** a before/after render showing what it changes (the
   inclusion rule).
6. **Fate spread** (accidents only): across 1,000 seeds, the share of worlds
   where it happens, and each alternative, is within the tuned range.

## 10. Time

- **World clock, fast by default.** Starting value: 1 world day ≈ 2 real
  minutes on the surface (eras 5–6). Earlier eras run on geological and
  cosmic time scales.
- **Speeds:** pause, 1×, 10×, 100×, and **skip to the next event**.
- **Live mode (optional):** surface sun and seasons follow the real clock, for
  wallpaper use.
- **Catch-up:** when the world is reopened, it fast-forwards through the time it
  missed and shows a recap, including any accidents fate rolled.
- **Replay:** any world can be replayed from its beginning, e.g. a genesis
  time-lapse from first stars to today in a few minutes.

## 11. Seeing it

- **Director camera:** glides to whatever is happening (an impact, a storm, a
  new species) and drifts slowly when nothing is.
- **World journal:** the world's history in plain words, marking which
  accidents came from fate and which from the player.
  *"Era 3: a Mars-sized body struck the planet (fate). A large moon formed."*
- **Accident tree:** possible, not yet (with reasons), happened, missed.
- **"While you were away"** recap on return.
- **Compare:** the same seed with different accidents, side by side.

## 11a. Exploring the planet

**Seamless zoom.** One continuous view from space to the ground:
space → planet → continent → valley → ground → one creature. No cuts, no
loading screens. The planet is a cube-sphere whose six faces are quadtrees:
chunks near the camera split into smaller, more detailed chunks and far ones
merge back. Chunk vertices are stored relative to the chunk centre, so precision
holds metres above an Earth-sized planet.

**Camera modes**

| Mode | What it does |
|---|---|
| Orbit | Turn the whole planet in space |
| Fly to a spot | Click anywhere and glide down to it |
| Ground view | Low over the land, looking toward the horizon |
| Follow | Pick a creature or species; the camera stays with it (with creatures) |
| Director | Goes on its own to wherever something is happening |

**Species:** click a creature to see its species, genes and family tree; a
species list flies the camera to where it lives; a map layer shows ranges.

**Two-level simulation.** The whole planet runs coarsely (climate, oceans,
plates, species as populations). Only where the camera looks is detail
generated: fine terrain, single trees, individual creatures, always derived
from the coarse state so they agree.

## 11b. Always-on wallpaper

- **Wallpaper mode:** the director drifts over the world like a nature
  documentary and goes to whatever is happening.
- **Pinned view:** a favourite spot, a species to follow, or the whole planet
  turning with the real day/night line.
- **Living terrariums:** pin any part of the planet as a small glass-cased
  diorama that keeps living. A desktop can show one or a shelf of them; each
  monitor can show a different place. The planet is the world; terrariums are
  windows into it.
- **Battery:** wallpaper renders only what's on screen, at 10–20 fps, stops
  when covered, while the simulation continues at the coarse level.
- **Platforms:** Mac via Plash (any web page as wallpaper), later a small
  native app; Windows via Lively Wallpaper or Wallpaper Engine; a Mac
  screensaver; the Aerie Fire TV screensaver; a phone widget and notifications
  for big events.

## 11c. Realism and AI world models

Realism comes first from the simulation and rendering: light scattering for
sky colour, sun and moon from real dates, ocean glint, terrain detail to metres,
weather. A **realistic render style** can sit beside low-poly.

AI world models (e.g. Google DeepMind's Genie) generate plausible video but
don't know the world's state, aren't deterministic and run on paid servers. As
of November 2026 there is no public API (Project Genie is a web app for Google
AI Ultra subscribers, 60-second sessions). If an API opens, it fits as an
optional **"visit in photoreal"** lens: a snapshot of one spot of the
simulated world (terrain, biome, weather, creatures) becomes a short photoreal
walk. The simulation stays the truth; nothing depends on the model.

## 12. Technology

- Browser first: three.js for rendering, **WebGPU compute** for simulation.
- Simulation runs separately from rendering, with rendering capped (30 fps) and
  paused when the tab is hidden.
- Deployed as a static site on Cloudflare. World saves stay on the player's
  device at first; sync, the gallery across devices and migration between
  worlds come later.

## 13. Roadmap

Each step is a finished release.

0. **Planet (first build done):** seamless cube-sphere LOD from orbit to
   ground, biomes, trees, real sun, camera modes (orbit, fly-to, ground,
   director), pinned wallpaper links. The old island lives at `island.html`;
   procedural assets at `assets.html`.
1. **Foundation:** world clock, speeds, ledger, snapshots, journal, the
   accident definition format, fate rolls, the accident tree screen, 48 h undo.
   (A first prototype of triggers and undo exists in `src/upgrades.js`, built
   on the earlier "laws as switches" model; it will be reworked into
   accidents.)
2. **First accidents on the island:** water from space, moon-forming impact,
   life starts, the asteroid, each with windows, odds and timing outcomes.
3. **Resets:** branch, guided world, fresh start, the gallery.
4. **Era 1: Cosmic dawn**, then **Era 2: First stars**: hydrogen, gravity and
   the first stars forging elements.
5. **Era 3–4:** planet formation, core, crust, atmosphere.
6. **Era 5–6 in depth:** surface physics, life and evolution.
7. Migration between players' worlds.

## 14. Open questions

- **Undo by re-simulation?** Instead of losing the time since triggering, the
  world could re-run from the snapshot without the accident.
- **Exact limits:** is 1 branch per world right? Does a guided world cost
  anything?
- **Migration between worlds with different accidents:** can a creature from a
  world with water arrive in one without it? Probably only between compatible
  worlds.
- **"What if" constants** (stronger gravity, different freezing point): a
  separate experiment mode?
- **Project name:** "Terrarium" may be too small for a universe.
