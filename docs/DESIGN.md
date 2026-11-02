# Terrarium — Design

> A universe that only knows the laws you give it.

Status: draft v1 · 2026-11-01

---

## 1. The idea

Every god game gives the player **powers**. Terrarium gives the player **laws of nature**.

A world starts at the very beginning, with hydrogen, helium and almost nothing
else, and grows forever using only what it has. New laws (gravity, fusion,
chemistry, water, plate tectonics, life…) arrive over time as **upgrades**.
Turning one on changes the world for good, the way evolution does.

Every world is an experiment. *What does a planet become without plate
tectonics? Without water? Without a moon?* Two players with the same seed and
different laws get different worlds.

## 2. Principles

1. **Real laws, game resolution.** We use the real equations (conservation of
   mass and energy, Navier–Stokes, the heat equation) on coarse grids. The laws
   are true; only the level of detail is lower.
2. **Nothing from nowhere.** Every resource is conserved. Water, energy and
   elements move between places and forms but are never created or deleted
   except by a law that really does that (fusion makes elements, for example).
3. **The world only has what it has.** Resources come from the simulation, never
   from the player. You can't buy oxygen. Your stars have to make it.
4. **The inclusion rule.** A piece of science gets in only if it changes
   something the player can see, or something life must adapt to.
5. **Drama comes from the laws, not from scripts.** No scripted events. Storms,
   extinctions and new species all come out of the simulation.
6. **The world keeps living.** Time runs while you're away, fast enough that
   something new has always happened.

## 3. Eras

You can't simulate atoms and islands at the same scale, so a world passes
through eras. Each era runs its own simulation at its own scale and hands its
**results** to the next. Later eras can only use what earlier eras produced.

| Era | What happens | Key laws | Hands forward |
|---|---|---|---|
| 1. Cosmic dawn | Hydrogen and helium clouds clump | Gravity | Where stars form, how big they are |
| 2. First stars | Stars ignite, fuse, explode | Fusion, stellar life cycle | Element abundances (C, O, Fe, Si…) |
| 3. Planet birth | Gas and dust disc forms planets | Accretion, chemistry | Planet mass, composition, orbit, moon |
| 4. Young planet | Core forms, volcanoes, crust | Geology, magnetism, outgassing | Atmosphere, magnetic shield, land |
| 5. Surface | Oceans, weather, rivers | Water, thermodynamics, fluids | Climate, coastlines, soil |
| 6. Life | Chemistry → cells → creatures | Biology, genetics, evolution | Living world |

Example chains that must emerge, not be scripted:

- Little iron → weak core → no magnetic field → solar wind strips the
  atmosphere → a dead, Mars-like world.
- No water law → no oceans → life never starts (unless an alternative-solvent
  law exists, e.g. methane life as on Titan).

The diorama island built in v0.1 is the **Era 5 view**: the zoom into a patch of
the planet's surface.

## 4. World model

- **Fields:** the world is a set of shared grids: temperature, water (by phase),
  air pressure and wind, elevation, soil, light, element amounts, and later
  biomass and creatures. Each era has its own grids and scale.
- **Resources:** totals of each element and of energy, tracked per world.
  They change only through laws.
- **World clock:** world time is separate from real time (see section 7).
- **Determinism:** the same seed + the same laws + the same player actions
  always give the same history. A world's history can therefore be stored as a
  short **ledger** (seed, law versions, actions with timestamps) instead of
  every frame.

## 5. Modules (laws)

Each law is a **module**: a self-contained piece of code with a fixed contract.

```
id, version         e.g. "water", 1.2.0
requires            other laws that must already be on (fusion before water)
reads / writes      the fields it uses and changes
conserves           what it must keep balanced (water mass, energy…)
step(world, dt)     advance the world by dt
budget              maximum cost per step
```

A module can only touch the fields it declares. Contributors add a law by
adding a module, without editing anyone else's.

### Acceptance checks (automatic, on every pull request)

1. **Conservation:** totals of everything it declares stay balanced to within
   tolerance over a long run.
2. **Stability:** a set of reference worlds runs 100 simulated years without
   values blowing up or every living thing dying for no physical reason.
3. **Budget:** it stays within its time and memory budget.
4. **Determinism:** the same inputs give bit-for-bit the same output.
5. **Visible effect:** a before/after render showing what it changes (the
   inclusion rule).

## 6. Upgrades (the player side of modules)

### 6.1 Lifecycle

```
released → available → on (undo window, 48 h) → permanent
                          │
                          └─ undo → off (world reverts)
```

1. **Released.** A new module (or a new version of one) ships. Every player
   gets it as an **available** upgrade. Nothing changes in their world yet.
2. **Optional.** Turning it on is always the player's choice. A world can
   stay without it forever, which is its own valid experiment.
3. **On.** From that moment the law acts on the world's existing resources.
   Its reactions start immediately, and the world grows with it.
4. **Undo window: 48 real hours.** For 2 days after turning a law on, the
   player can undo it. After that it is **permanent**: the world has grown with
   it and it can never be turned off.
5. **Undo = revert.** Undoing returns the world to the exact moment before the
   law was turned on, as if it had never existed. Everything that happened
   since is lost (the screen says so before confirming).

### 6.2 Rules that follow from this

- **Snapshot on activation.** Turning a law on saves a full snapshot of the
  world. The snapshot is kept for the 48 h window, then deleted.
- **Undo is stacked.** If law B was turned on after law A, and both are still
  inside their window, undoing A also undoes B (B grew in a world with A).
  The confirm screen lists everything that will be undone.
- **No partial undo.** A law is either fully on from its activation point or
  never happened. There is no "turn it off from now on".
- **Requirements.** A law with requirements (e.g. water needs fusion) can't be
  turned on until they're on and **permanent**. That stops one undo from
  breaking another law's foundations.
- **Missing resources.** A law can be on before the world has what it needs.
  It stays dormant until the resources appear (water can't form until stars
  have made oxygen). The upgrade screen says so.
- **New versions.** A new version of a law is itself an upgrade: optional, with
  its own 48 h window. Worlds keep the version they turned on until the
  player upgrades it.
- **Turning a law on again after an undo** is allowed: it starts from the
  world as it is then, with a new window.
- **Away from the world.** The window counts in real time, even while the
  world is closed. The world keeps growing during it.

### 6.3 Why irreversible

Real history only moves forward. Making a choice permanent is what makes it
matter, and what makes two players' worlds truly different. The 48 h window is
there for mistakes, not for previewing the future forever.

## 7. Time

- **World clock, fast by default.** Starting value: 1 world day ≈ 2 real
  minutes on the surface (eras 5–6). Earlier eras run on geological and
  cosmic time scales.
- **Speeds:** pause, 1×, 10×, 100×, and **skip to the next event**.
- **Live mode (optional):** surface sun and seasons follow the real clock, for
  wallpaper use.
- **Catch-up:** when the world is reopened, it fast-forwards through the time it
  missed (simplified, on the GPU) and shows a recap.
- **Replay:** because of determinism, any world can be replayed from its
  beginning, e.g. a genesis time-lapse from first stars to today in a few
  minutes.

## 8. Seeing it

- **Director camera:** glides to whatever is happening (a star igniting, a storm
  forming, a fire, a new species) and drifts slowly when nothing is.
- **World journal:** the world's history in plain words. *"Era 2, 40 million
  years: the first supernova scattered oxygen."*
- **"While you were away"** recap on return.
- **Compare:** the same seed with different laws, side by side.

## 9. Technology

- Browser first: three.js for rendering, **WebGPU compute** for simulation.
- Simulation runs separately from rendering, with rendering capped (30 fps) and
  paused when the tab is hidden.
- Deployed as a static site on Cloudflare. World saves stay on the player's
  device at first; sync and migration between worlds come later.

## 10. Roadmap

Each step is a finished release.

1. **Foundation:** world clock, speeds, journal, ledger, snapshots, module
   contract, upgrade screen with the 48 h undo.
2. **Era 1: Cosmic dawn.** Only hydrogen, helium and gravity. Watch clouds
   clump into the first stars.
3. **Era 2: First stars.** Fusion upgrade: stars ignite, forge elements and
   explode.
4. **Era 3–4:** planet formation, core, crust, atmosphere.
5. **Era 5:** water and thermodynamics on the surface (the island).
6. **Era 6:** life and evolution.
7. Migration between players' worlds.

## 11. Open questions

- **Undo by re-simulation?** Instead of losing the time since activation, the
  world could re-run from the snapshot without the law, fast-forwarding to
  now, so it shows "what would have happened without it". Costlier, but the
  world never loses time.
- **How many undos?** Unlimited within the window, or a limit per law?
- **Migration between worlds with different laws:** can a creature from a
  world with water arrive in a world without it? Probably only between
  compatible worlds.
- **Constant dials** (stronger gravity, different freezing point): upgrades,
  or a separate "experiment" mode?
- **Project name:** "Terrarium" may be too small for a universe.
