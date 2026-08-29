---
name: cleo-sanny-builder
description: Canonical guide for developing, compiling, and debugging CLEO scripts (.cs) for GTA San Andreas and SA-MP using Sanny Builder. Covers coordinate extraction (actor/vehicle), 3D Euclidean distances, dynamic string buffers, file I/O (JSON logging), key detection, timing invariants, Wine/Bottles CLI on Linux, and common compiler pitfalls.
---

# CLEO Scripting & Sanny Builder Development Guide

This skill provides comprehensive rules, opcodes, memory management patterns, file I/O operations, and compilation workflows for developing robust CLEO scripts (`.cs`) for GTA San Andreas and SA-MP using Sanny Builder.

---

## 1. Fundamentals & Architecture

### CLEO Script (`.cs`) vs Microsoft C# (`.cs`)
- In GTA modding and Sanny Builder, `.cs` stands for **Custom Script / CLEO Script** (compiled bytecode for the San Andreas script engine).
- **NEVER** use `dotnet build`, `csc`, or C# compilers on these files. They are Sanny Builder source/binary files.

### Script Directives
Every standalone CLEO script must begin with appropriate directives:
```sb
{$CLEO .cs}          // Declares a CLEO script that compiles directly to binary .cs
{$USE CLEO, file}    // Activates CLEO and file system opcodes
script_name "REC_GPS"
```
- `{$CLEO}` automatically instructs Sanny Builder to treat the file as a header-less thread with relative label offsets and output `.cs`.
- `{$USE CLEO, file}` enables standard CLEO extensions and file system operations (`0A9A`, `0AD8`, etc.).

### The Invariant of the Script Loop (`wait 0`)
GTA San Andreas executes scripts cooperatively on the main game thread. **Every execution loop must contain `wait 0`** (or a positive wait time):
```sb
:MAIN_LOOP
wait 0  // MANDATORY: Hands control back to the game engine for 1 frame.
// ... your logic ...
goto @MAIN_LOOP
```
> [!CAUTION]
> If any loop runs without a `wait` instruction, the entire GTA:SA / SA-MP process will instantly freeze/hang.

---

## 2. GTA San Andreas Coordinates & Extraction

### Coordinate Space
- **X:** `[-3000.0, 3000.0]` (West to East)
- **Y:** `[-3000.0, 3000.0]` (South to North)
- **Z:** `[-100.0, 500.0]` (Elevation / Altitude)

### Player Position (On-Foot vs Vehicle)
In GTA:SA, retrieving player position requires checking whether the player is on foot or inside a vehicle:
```sb
// Variables:
// 0@ = X (Float), 1@ = Y (Float), 2@ = Z (Float)
// 3@ = Vehicle Handle (Int)

if 00DF: actor $PLAYER_ACTOR driving
then
    // Player is inside a vehicle: get position from the vehicle
    03C0: 3@ = store_current_car_char_is_in $PLAYER_ACTOR
    00AA: store_car 3@ position_to 0@ 1@ 2@
else
    // Player is on foot: get position from actor
    00A0: store_actor $PLAYER_ACTOR position_to 0@ 1@ 2@
end
```

### Orientation and Speed
- **Actor Heading (Z angle):** `0172: 4@ = actor $PLAYER_ACTOR z_angle` (degrees 0.0 - 360.0)
- **Vehicle Heading (Z angle):** `0174: 4@ = car 3@ z_angle`
- **Vehicle Speed:** `02E3: 5@ = car 3@ speed` (returns float speed in game units; multiply by `3.6 * 50.0 / 100.0` or roughly `~180` for km/h approximation).

---

## 3. Spatial Math: 3D Euclidean Distance (`050A`)

Sanny Builder provides native 3D distance calculation:
```sb
// Computes Euclidean distance: sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-z1)^2)
050A: 7@ = distance_between_XYZ 0@ 1@ 2@ and_XYZ 3@ 4@ 5@
```

### Breadcrumbs Recording Pattern (Every 10 Metres)
According to SPEC.md §7.8.3, recording curved off-road paths requires capturing a coordinate breadcrumb every 10 metres:
```sb
// 0@, 1@, 2@ = Current Coordinates (X, Y, Z)
// 6@, 7@, 8@ = Last Recorded Coordinates (X, Y, Z)
// 9@ = Calculated Distance (Float)

050A: 9@ = distance_between_XYZ 0@ 1@ 2@ and_XYZ 6@ 7@ 8@

if 9@ >= 10.0
then
    // 1. Write (0@, 1@, 2@) to breadcrumbs log
    // 2. Update last position:
    6@ = 0@
    7@ = 1@
    8@ = 2@
    // 3. Play audio feedback tick
    018C: play_sound 1137 at 0.0 0.0 0.0
end
```

---

## 4. Memory Management & Dynamic String Buffers

### Variable Limits in Sanny Builder
- Each CLEO script thread has **32 local variables**: `0@` through `31@`.
- Plus 2 script timers: `TIMERA` (`32@`) and `TIMERB` (`33@`).
- By default, variables are untyped DWORDs. To declare floats explicitly:
  ```sb
  var
      0@ : Float
      1@ : Float
      2@ : Float
  end
  ```

### The String Overflow Trap
- String variables `@s` (short string) are limited to **8 bytes** (occupies 2 local variable slots).
- String variables `@v` (long string) are limited to **16 bytes** (occupies 4 local variable slots).
- Attempting to format a JSON string like `{"x": 1234.56, "y": -2345.67}` into `@v` causes an immediate memory overflow or crash.

### Safe Dynamic String Buffer Pattern
Always allocate dynamic heap memory for formatting strings and JSON payloads:
```sb
// 1. Allocate a 256-byte buffer in heap
0AC8: 10@ = allocate_memory_size 256

if 10@ <> 0
then
    // 2. Format the string into the allocated pointer
    0AD3: string 10@ format "{\"x\": %.2f, \"y\": %.2f, \"z\": %.2f}%c%n" 0@ 1@ 2@ 13 10
    
    // 3. Write buffer to file (12@ is an open file handle)
    0AD8: write_string_to_file 12@ from 10@
    
    // 4. Always free memory to avoid leaks
    0AC9: free_allocated_memory 10@
end
```

Format specifiers for `0AD3`:
- `%d` / `%i`: Integer
- `%f` / `%.2f`: Floating point (specify precision with `.2f`)
- `%s`: String pointer
- `%c`: Single character (e.g. `13` for Carriage Return `\r`)
- `%n`: Newline character (`\n`)

---

## 5. File I/O Operations

### Opening and Appending Files (`0A9A`)
- Modes:
  - `"at"`: Append text (creates file if not present; appends to the end)
  - `"wt"`: Write text (creates file; truncates existing content)
  - `"rt"`: Read text

```sb
// Open file in GTA San Andreas or CLEO root directory
0A9A: 12@ = openfile "shortcuts_dump.json" mode "at"

if 12@ <> 0
then
    // File opened successfully
    0AD8: write_string_to_file 12@ from 10@
    
    // Always close file immediately after writing to flush OS buffers
    0A9B: closefile 12@
end
```

---

## 6. Key Detection & Hotkeys

### Keyboard Detection (`0AB0`)
`0AB0: is_key_pressed <virtual_key_code>` checks physical keyboard keys directly:

| Key | Hex Code | Decimal Code | Sanny Enum |
|---|---|---|---|
| **Ctrl (Control)** | `0x11` | 17 | `KeyCode.Control` |
| **Shift** | `0x10` | 16 | `KeyCode.Shift` |
| **Alt (Menu)** | `0x12` | 18 | `KeyCode.Menu` |
| **Key 1** | `0x31` | 49 | `KeyCode.Key1` |
| **Key 2** | `0x32` | 50 | `KeyCode.Key2` |
| **Key 3** | `0x33` | 51 | `KeyCode.Key3` |
| **Key C** | `0x43` | 67 | `KeyCode.C` |
| **F4** | `0x73` | 115 | `KeyCode.F4` |

### Hotkey Combination with Debounce
To detect a combination such as `Ctrl + 1` without repeatedly triggering 60 times per second:
```sb
if and
    0AB0: is_key_pressed 0x11   // Ctrl
    0AB0: is_key_pressed 0x31   // '1'
then
    // Execute action
    018C: play_sound 1057 at 0.0 0.0 0.0
    print_formatted_now "Start: ~g~CAPTURED" time 1500
    
    // Debounce wait to avoid repeated triggers while key is held down
    wait 250
end
```

---

## 7. Audio & On-Screen Visual Feedback

### Sound Effects (`018C`)
Always requires 4 parameters: sound ID and 3D coordinates (use `0.0 0.0 0.0` for ambient / UI sounds):
- `018C: play_sound 1057 at 0.0 0.0 0.0` — High-pitch confirmation beep (Success / On).
- `018C: play_sound 1058 at 0.0 0.0 0.0` — Low-pitch error tone (Cancel / Off).
- `018C: play_sound 1137 at 0.0 0.0 0.0` — Camera / tick click sound (Waypoints).

### On-Screen Text
- `print_formatted_now "Text" time 1500`: Standard GTA banner text.
- GTA Color tags:
  - `~g~` = Green
  - `~r~` = Red
  - `~y~` = Yellow
  - `~b~` = Blue
  - `~w~` = White
  - `~h~` = Lighter shade

---

## 8. Compiler Troubleshooting & Pitfalls

### Common Sanny Builder Errors

| Error Code | Meaning & Cause | Solution |
|---|---|---|
| `0049: Not enough parameters for opcode` | Missing required parameters in an opcode (e.g. `018C` called with 1 param instead of 4; or `print_formatted_now` without `time`). | Add the missing coordinates `at 0.0 0.0 0.0` or keyword `time <ms>`. |
| `0001: wait // error, expected one parameter` | Bare `wait` keyword without duration. | Always write `wait 0` or `wait 250`. |
| `0014: Incorrect expression` | Type mismatch in assignment or invalid condition syntax. | Declare types explicitly with `var .. end` or use explicit opcodes. |
| `0071: Incorrect number of conditions` | More than 8 conditions chained under `if and` / `if or`. | Split into nested `if` statements. |
| `0081: Too many actual parameters` | Extra arguments passed to an opcode. | Check Sanny Builder opcode definition. |
| `CS2015: binary file instead of text file` | Attempting to compile `.cs` with Microsoft C# Roslyn (`dotnet`/`csc`). | Compile using `sanny.exe` via Wine/Bottles, never `dotnet`. |

---

## 9. Linux Compilation Workflow (Wine / Bottles)

To compile Sanny Builder scripts headlessly or interactively on Linux (Fedora / Ubuntu / Arch):

### Direct Wine Execution
```bash
wine sanny.exe --compile tools/cleo/shortcut_recorder.txt tools/cleo/shortcut_recorder.cs --game sa --no-splash
```

### Bottles Configuration
1. Bottle Environment: **Gaming**
2. Runner: **Soda** (`soda-11.0-4` or newer)
3. Sandbox: **Disabled** (to allow reading workspace files and writing `.cs` files)
4. DLL Overrides:
   - `vorbisfile` -> `Native, Builtin`
   - `d3d9` -> `Native, Builtin`
