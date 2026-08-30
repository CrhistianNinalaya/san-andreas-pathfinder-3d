---
name: cleo-sanny-builder
description: Canonical guide for developing, compiling, and debugging CLEO scripts (.cs) for GTA San Andreas and SA-MP using Sanny Builder. Covers coordinate extraction (actor/vehicle), 3D Euclidean distances, dynamic string buffers, file I/O (JSON logging), key detection, timing invariants, Wine/Bottles CLI on Linux, and common compiler pitfalls.
---

# CLEO Scripting & Sanny Builder Development Guide

This skill provides comprehensive rules, opcodes, memory management patterns, file I/O operations, compiler error resolutions, and compilation workflows for developing robust, crash-proof CLEO scripts (`.cs`) for GTA San Andreas and SA-MP using Sanny Builder.

---

## 1. Fundamentals & Architecture

### CLEO Script (`.cs`) vs Microsoft C# (`.cs`)
- In GTA modding and Sanny Builder, `.cs` stands for **Custom Script / CLEO Script** (compiled bytecode for the San Andreas script engine).
- **NEVER** use `dotnet build`, `csc`, or C# compilers on these files. They are Sanny Builder source/binary files.

### Script Directives & Naming
Every standalone CLEO script should begin with the CLEO directive and an explicit script name:
```sb
{$CLEO .cs}

script_name "GPSREC"
```

### Initial Synchronization Invariant (`wait 2500`)
> [!CRITICAL]
> **NEVER call file operations (`0A9A: openfile`) or dynamic memory allocation (`0AC8: allocate_memory_size`) at byte offset 0 before the first `wait`!**
> When GTA San Andreas initializes custom scripts, executing plugins before the script thread has called `wait` at least once crashes the game instantly during registration (`cleo.log` stops right at `Registering custom script`).
> Always begin with:
> ```sb
> wait 2500 // Gives the engine and SA-MP time to load models, world, and plugins
> ```

### The Loading Screen & Spawn Crash Rule (`0x004677FD`)
> [!CAUTION]
> When GTA San Andreas loads a savegame, or when SA-MP / `samp_debug` starts in the **skin/class selection screen**, CJ has **not yet spawned** in the world.
> At this time, `$PLAYER_ACTOR` is a **NULL pointer (`0x00000000`)**.
> Calling `00A0: store_actor $PLAYER_ACTOR` or `00DF: actor $PLAYER_ACTOR driving` when `$PLAYER_ACTOR` is null causes an immediate **Access Violation Crash (0xC0000005) at address `0x004677FD` (`CRunningScript::ProcessOneCommand`)**.
> 
> **Rule:** ALWAYS guard position reading with:
> ```sb
> 01F5: $PLAYER_ACTOR = get_player_actor $PLAYER_CHAR
> if 056D: actor $PLAYER_ACTOR defined
> then
>     // Safe to read coordinates or vehicle status
> end
> ```

### The `:WAIT_SPAWN` Infinite Loop Trap
- In Single Player, `main.scm` initializes `$PLAYER_CHAR = 0` and sets `$PLAYER_ACTOR`.
- In SA-MP (`samp_debug`), `main.scm` is stripped/empty.
- **NEVER** create a blocking `while not 056D` or loop jumping to `:WAIT_SPAWN` before `:MAIN_LOOP`. If `$PLAYER_CHAR` is not yet populated by the engine, the script thread stays stuck in that loop forever and never enters `:MAIN_LOOP`.
- **Solution:** Use `wait 2500` once, enter `:MAIN_LOOP`, and check `056D: actor $PLAYER_ACTOR defined` non-blockingly inside the loop.

---

## 2. GTA San Andreas Coordinates & Extraction

### Coordinate Space
- **X:** `[-3000.0, 3000.0]` (West to East)
- **Y:** `[-3000.0, 3000.0]` (South to North)
- **Z:** `[-100.0, 500.0]` (Elevation / Altitude)

### Universal Position Extraction (On-Foot, Car, Motorcycle)
In GTA:SA, `00A0: store_actor` returns the player's true coordinates in all situations (on foot, inside cars, or riding motorcycles like the NRG-500):
```sb
01F5: $PLAYER_ACTOR = get_player_actor $PLAYER_CHAR
if 056D: actor $PLAYER_ACTOR defined
then
    // Universal coordinates and orientation
    00A0: store_actor $PLAYER_ACTOR position_to 0@ 1@ 2@
    0172: 20@ = actor $PLAYER_ACTOR z_angle

    // Vehicle speed (if driving/riding)
    if 00DF: actor $PLAYER_ACTOR driving
    then
        03C0: 3@ = store_current_car_char_is_in $PLAYER_ACTOR
        02E3: 21@ = car 3@ speed
        21@ *= 175.0 // Approximate conversion to km/h
    else
        21@ = 0.0
    end
end
```

---

## 3. Spatial Math & Breadcrumbs Recording

### 3D Euclidean Distance (`050A`)
```sb
// Computes Euclidean distance: sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-z1)^2)
050A: 10@ = distance_between_XYZ 4@ 5@ 6@ and_XYZ 7@ 8@ 9@
```

### The Breadcrumbs Point #1 Invariant
> [!IMPORTANT]
> When the user toggles recording ON, **point #1 `{ pt: 1, x, y, z }` must be saved IMMEDIATELY** to the JSON file.
> If the script only writes when `distance >= 10.0`, any short movement before toggling OFF will record **0 points**.
> 
> **Sampling rate:** Sample every **5.0 meters** with an audio click cue (`018C: play_sound 1137 at 0.0 0.0 0.0`) so the player hears confirmation while driving.

---

## 4. Memory Management & SCM Parameter Limits

### SCM Parameter Count Limit (Crash on `0AD3`)
> [!CRITICAL]
> The GTA San Andreas script virtual machine (`CRunningScript::CollectParameters()`) has an internal parameter limit (typically 16 tokens total).
> Calling `0AD3: string format` with **11 or more variables in a single line** overflows the argument stack and causes an **instant crash to desktop** when the hotkey is pressed!
> 
> **WRONG (Causes instant crash):**
> ```sb
> // 11 variables in one call -> STACK OVERFLOW CRASH!
> 0AD3: string 17@ format "{\"id\": %d, \"type\": \"%s\", \"start\": {\"x\": %.2f, \"y\": %.2f, \"z\": %.2f}, \"end\": {\"x\": %.2f, \"y\": %.2f, \"z\": %.2f}, \"dist\": %.2f, \"drop\": %.2f},%c%n" 22@ 4@ 5@ 6@ 7@ 8@ 9@ 10@ 25@ 13 10
> 0AD8: write_string_to_file 18@ from 17@
> ```
> 
> **RIGHT (Split into two safe writes):**
> ```sb
> // Part 1: 4 parameters
> 0AD3: string 17@ format "{\"id\": %d, \"type\": \"offroad\", \"start\": {\"x\": %.2f, \"y\": %.2f, \"z\": %.2f}" 22@ 4@ 5@ 6@
> 0AD8: write_string_to_file 18@ from 17@
> 
> // Part 2: 5 parameters
> 0AD3: string 17@ format ", \"end\": {\"x\": %.2f, \"y\": %.2f, \"z\": %.2f}, \"dist\": %.2f, \"drop\": %.2f},%c%n" 7@ 8@ 9@ 10@ 25@ 13 10
> 0AD8: write_string_to_file 18@ from 17@
> ```

### `print_formatted_now` (`0AD1`) Float Formatting Limit
- Passing 4+ floating point parameters (e.g. `X:%.1f Y:%.1f Z:%.1f`) to `print_formatted_now` can silently fail to render or overflow the subtitle string buffer in CLEO 4.
- **Rule:** Keep banner notifications simple (1-2 integer parameters, e.g. `Inicio Atajo #%d CAPTURADO`). The HUD handles real-time float display via `0AD1: show_formatted_text_high`.

### Strict Variable Typing in `var ... end`
When declaring typed local variables:
```sb
var
    0@ : Float
    3@ : Int
    4@ : Float
    31@ : Int
end
```
- Sanny Builder enforces strict type checking: assigning `3@ = 4@` (`Int = Float`) throws:
  `Incorrect expression 3@ = 4@. One of the variables has an unknown type, or the operands are incompatible.`
- Always declare dedicated variables as `Int` (e.g. `31@ : Int`) for memory pointers and integers.

### The Per-Frame Memory Allocation Crash (`0x00000000` / Use-After-Free)
> [!CRITICAL]
> **NEVER call `0AC8: allocate_memory_size` and `0AC9: free_allocated_memory` every frame inside `:MAIN_LOOP`!**
> If you allocate a string buffer for HUD rendering and immediately free it with `0AC9`, the pointer passed to `0AD1: show_formatted_text_high` becomes a **dangling pointer**. When GTA's DirectX render pipeline attempts to draw the subtitle at the end of the frame, it reads freed memory and crashes instantly with `Exception At Address: 0x00000000`!
>
> **The Pure-Integer Pattern for Real-Time HUDs:**
> GTA SA's `CMessages` subtitle engine natively renders integers (`%d`). Convert floats to integers using `008C: float_to_integer` without any dynamic memory allocations:
> ```sb
> 008C: 30@ = float_to_integer 0@ // X
> 008C: 28@ = float_to_integer 1@ // Y
> 008C: 29@ = float_to_integer 2@ // Z
> 008C: 27@ = float_to_integer 21@ // Speed
> 0AD1: show_formatted_text_high "X:~y~%d ~w~Y:~y~%d ~w~Z:~y~%d ~w~| ~g~%d ~w~km/h" time 120 30@ 28@ 29@ 27@
> ```

---

## 5. File I/O Operations

### Opening and Appending Files (`0A9A`)
- Relative paths (e.g. `"shortcuts_dump.json"`) write directly to the **GTA San Andreas root directory** (`GTA San Andreas/shortcuts_dump.json`).
- Always open with `"at"` (append text) and close immediately with `0A9B: closefile` to flush OS write buffers:
```sb
0A9A: 18@ = openfile "shortcuts_dump.json" mode "at"
if 18@ <> 0
then
    0AC8: 17@ = allocate_memory_size 256
    if 17@ <> 0
    then
        0AD3: string 17@ format "..." ...
        0AD8: write_string_to_file 18@ from 17@
        0AC9: free_allocated_memory 17@
    end
    0A9B: closefile 18@
end
```

---

## 6. Key Detection & Hotkeys (Wine / Linux Compatibility)

### Wine / Linux Keyboard Nuances
1. **Virtual Key Codes in Wine:**
   - Left Control is often reported as `162` (`VK_LCONTROL`) rather than `17` (`VK_CONTROL`).
   - Top-row numbers (`49`, `50`, `51`) are distinct from Numpad numbers (`97`, `98`, `99`).
   - Window managers in Linux (GNOME/KDE/XFCE) frequently intercept `Ctrl + 1` for tab or workspace switching.
2. **`if or` Syntax in Sanny Builder:**
   - Sanny Builder does not support bare `if or` with condition branches without explicit condition counts; it throws `Not enough actual parameters` or `Too many actual parameters`.
   - **Solution:** Use simple boolean flags (`26@ = 1`) across sequential `if` statements.
3. **Single Dedicated Keys (Ergonomic for Driving):**
   - Operating two keys simultaneously while driving at high speed in GTA is clumsy. Provide dedicated single-key hotkeys:
     - **`I` (73):** Marcar Inicio.
     - **`O` (79):** Marcar Fin y Guardar.
     - **`P` (80):** Toggle Modo Curvas (Breadcrumbs).
     - **`F3` (114) / `F4` (115):** Toggle HUD Coordenadas.

---

## 7. Troubleshooting & Error Catalog

| Error / Symptom | Root Cause | Exact Solution |
| :--- | :--- | :--- |
| `[0A8D] Unallowed size 12045720` in `cleo.log` | Address (`0xB7CD98` = 12045720) passed as size argument due to inverted parameter definition in `SASCM.ini`. | Eliminate raw `read_memory`. Use standard opcodes `01F5` + `056D` + `00A0`. |
| `Unknown operator :.` | Putting `not` before an opcode with number (e.g. `if not 0256:`). Sanny Builder parses `not` on expressions only. | Use standard GTA SCM `jf` syntax: `if` on one line, opcode on next line, and `jf @LABEL`. |
| `Unknown directive else_jump @LABEL` | `else_jump` is not a standard SCM directive in Sanny Builder. | Use structured syntax: `if not <condition> then jump @LABEL end`, or `jf @LABEL`. |
| `Exception At Address: 0x00000000` | Dynamic heap allocation (`0AC8`/`0AC9`) or touching entities before spawn. | 1. Add `:WAIT_SPAWN` loop checking `0256: player 0 defined`.<br>2. Use local long string buffer `16@v` instead of `0AC8`/`0AC9`.<br>3. In SA-MP use `03C1: store_car_char_is_in_no_save` instead of `03C0`. |
| `Exception At Address: 0x00466182` | Calling `056D: actor $PLAYER_ACTOR defined` in SA-MP. SA-MP actors are created by `samp.dll`, not SCM. `056D` indexes `PedPool` and crashes with `EAX: 0xFFFFFFFF`. | Use `Alloc($PLAYER_ACTOR, 3)` and wait until spawned via `0256: player 0 defined`. |
| `Not enough actual parameters for the command.` | Using decompiled keywords like `0256: is_player_playing 0` instead of standard `SASCM.INI` definition (`0256: player 0 defined`). | Use canonical `SASCM.INI` keyword: `0256: player 0 defined`. |
| File I/O crashes in CLEO 4 (`0A9A`, `0AD9`, `0x00000000`) | Sanny Builder 4 parameter inversion bugs across all raw file commands. | **Use `IniFiles.cleo`**: Call `0AF3: write_float ... to_ini_file "cleo/shortcuts.ini"` directly. Bypasses `fopen`, eliminates handles, and delegates to Windows kernel `WritePrivateProfileStringA` for 100% crash immunity. Convert to JSON with `tools/import-shortcuts.mjs`. |
| `0A9A: open_file` crash at `0x00000000` | Passing mode as a string (e.g. `mode "at"`) triggers a known parameter inversion bug in CLEO 4, causing `fopen` to be called with a NULL pointer. | Pass mode as a legacy hex integer: `mode 0x61` (`'a'` append), `mode 0x77` (`'w'` write), `mode 0x72` (`'r'` read). Open file once on REC start and close once on STOP. |
| `06AC` / `03C0` parameter inversion (`COMMAND_4901`, `COMMAND_0C02`) | Sanny Builder compiles `var = actor movement_speed` and `var = store_current_car_char_is_in` with inverted operands, shifting the SCM instruction pointer by 1 byte and crashing on the next instruction. | **Pure Coordinates Architecture**: never use `06AC` or `03C0` in the HUD loop. Use strictly `00A0: store_actor position_to` -> `008C: float to_integer` -> `045A: draw_text_1number`. |
| `00AA: store_car` crash on vehicle entry (`AA00`) | Calling `00AA: store_car 10@ position_to` while entering/mounting a vehicle or motorcycle before the handle is fully populated. | **Use universal `00A0`**: `00A0: store_actor $PLAYER_ACTOR position_to 0@ 1@ 2@` works in ALL vehicles (cars, bikes, planes) and on foot. Never use `00AA` for coordinates. |
| HUD Rendering Crashes (`COMMAND_2020`, `COMMAND_6631`, `0x00000000`) | Sanny Builder 4 and CLEO 4 parameter misalignments in variable-parameter opcodes (`0AD1`, `print_formatted_now`). | **Use GTA's native HUD opcodes**: convert floats with `008C: var = float f to_integer` and render with `045A: draw_text_1number x y GXT 'NUMBER' number var` (identical to `Status-Indicators.cs`). |
| `@v` Buffer Overflow / `COMMAND_312E` / `COMMAND_6631` | Sanny Builder `@v` variables (like `16@v`) have a hard capacity of only **16 bytes**. Formatting strings $> 15$ chars into `@v` smashes local variables and corrupts `m_pBytePointer`. | For strings $> 15$ characters, allocate a 256-byte heap buffer once at startup (`0AC8: 27@ = allocate_memory_size 256`) and format into `27@`. |
| `COMMAND_6631` / String executed as opcodes | `0AD1: show_formatted_text_high` with multiple format parameters fails to compile parameter markers in Sanny Builder, causing the string text to be executed as SCM opcodes. | Never use `0AD1` with multiple arguments. Decouple formatting and display: use `0AD3: 27@ = string_format "..." ...` followed by `0ACD: show_text_highpriority 27@ time 120`. |
| `COMMAND_0400 [UNKNOWN]` / Crash at `0x004897E4` | Nested `if ... then ... else ... end` blocks desynchronize the SCM jump table. Jumps land in the middle of operands, reading byte `00 04` as opcode `0400` (`store_coords_from_object`). | **Flatten the script**: replace nested `then/else/end` with standard flat SCM labels (`jf @LABEL` / `goto @LABEL`), exactly like `Status-Indicators.txt`. |
| Calling `01F5: get_player_actor 0` crashes at `0x00000000` | In SA-MP, `CWorld::Players[0]` is hooked and null; `01F5` dereferences `0x00000000`. | Never call `01F5` in SA-MP. Use `Alloc($PLAYER_ACTOR, 3)` and access `$PLAYER_ACTOR` directly inside `if 0256: player 0 defined`. |
| Crash on pressing `F4` in SA-MP (`0x00000000`, `SCM Op: 0x2EB`) | `F4` is SA-MP's hardwired Class Selection / suicide hotkey. In `samp_debug` there are no classes, causing instant crash. | Never use F-keys (`F1`-`F12`) in SA-MP. Use dedicated letter keys: `K` or `H` for HUD, `I` for Start, `O` for End. |
| `Exception At Address: 0x004897E4` | Calling actor/player opcodes while SA-MP is executing its internal spawn sequence (`0446: set_actor dismemberment`). | Use **Passive Mode**: do not poll entities on load. Loop listening only for hotkeys (`0AB0`), and query `01F5` on-demand only when HUD is toggled ON. |
| `Too many actual parameters. Expected 0 params.` | Using non-existent opcodes like `03C1` in `SASCM.INI`. When an opcode is undefined, Sanny Builder assumes 0 params. | Use canonical `03C0: 3@ = store_current_car_char_is_in $PLAYER_ACTOR`. |
| `0AD3` formatting syntax error | Writing `0AD3: string 16@v format "..."` instead of the signature in `SASCM.CLEO.ini` (`%1d% = string_format %2s%`). | Use exact syntax: `0AD3: 16@v = string_format "..." ...`. |
| `Incorrect expression 3@ = 4@` | Assigning a `Float` variable to an `Int` variable in a typed `var` block. | Declare a dedicated `Int` variable (`31@ : Int`) for pointers/handles. |
| Game crashes right upon pressing Save hotkey | `0AD3: string format` called with 11+ arguments, exceeding SCM stack limits. | Split the JSON line into two separate `0AD3` + `0AD8` calls. |
| Game crashes at loading screen (`0x004677FD`) | Calling `00A0: store_actor` or `00DF: actor driving` while `$PLAYER_ACTOR` is null during load. | Guard with `if 056D: actor $PLAYER_ACTOR defined`. |
| Game crashes immediately upon launch (byte offset 0) | Calling `0A9A: openfile` or `0AC8` before the first `wait`. | Move all file and heap calls after `wait 2500`. |
| Script never starts / no sound / no text | Script stuck in infinite `:WAIT_SPAWN` loop because `$PLAYER_CHAR` was never populated. | Remove the blocking spawn loop; use `wait 2500` then enter `:MAIN_LOOP`. |
| Sound is 100% inaudible | `018C: play_sound` called `at 0.0 0.0 0.0` (in the ocean, attenuated to 0 volume). | Use `018C: play_sound [ID] at 0.0 0.0 0.0` only for UI sounds, or at `0@ 1@ 2@` for in-world emitter. |
| `Ctrl + 1` does not respond in Wine | Key 49 not mapped under Ctrl in Spanish keyboard layout, or Numpad 1 used (97). | Use single key **`I`** (73) or multi-code detection (`17` + `49` / `17` + `97`). |

---

## 8. SA-MP & `samp_debug` Commands

When debugging routes and terrain in `samp_debug`:
- Open chat with **`T`** or **`F6`**.
- `/v 522` — Spawn **NRG-500** (fastest bike for jumps and shortcuts).
- `/v 468` — Spawn **Sanchez** (best offroad bike for steep mountains).
- `/v 495` — Spawn **Sandking** (4x4 offroad truck).
- `/v 411` — Spawn **Infernus** (supercar for highway speed tests).
