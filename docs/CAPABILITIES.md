# Conversion capabilities

BTP Translator reads Python with the Lezer Python parser and builds Blockly blocks from a typed intermediate form. It does not use regular expressions as the parser.

Translation is one way. Changing a block does not rewrite the Python file.

A program is marked fully translated only when there are no warnings and no errors. Unsupported lines stay in the workspace as kept-source blocks.

## Python

Supported:

- Assignments, updates, numbers, strings, booleans, and lists
- Arithmetic, comparisons, boolean logic, and conditional expressions
- `if`, `elif`, and `else`, including nested conditions
- `for` and `while`, including `break` and `continue`
- Function definitions, calls, and `return`
- Comments and docstrings
- `await`, `async def`, `multitask`, and `run_task` for supported Pybricks programs
- `pass`, `print`, `len`, `abs`, `min`, `max`, `int`, and `str`

Kept as source, with a warning:

- Classes, `try`, `with`, `match`, `lambda`, comprehensions, `yield`, `raise`, `del`, `assert`, and decorators
- Syntax the parser cannot represent as a block

`not` is repaired so `not ready and flag` follows Python rather than the parser's tighter binding. A comparison chain such as `0 < x < 10` becomes two comparisons joined with and when the middle value is a simple name or literal. A numeric `range` loop shows an inclusive end on the standard count loop. Other ranges keep Python's exclusive stop on a range block.

## Pybricks

Method names and units follow the current Pybricks documentation:

- Motor speed is degrees per second. Time arguments are milliseconds. Angles are degrees.
- DriveBase distance is millimetres. `straight`, `turn`, and `arc` are supported. `curve` is the older name and is kept as source with a note to use `arc`.
- Prime Hub and Inventor Hub share the documented hub components.
- Color, ultrasonic, and force sensors use the documented units. Force is newtons. Ultrasonic distance is millimetres.
- `wait` is milliseconds. StopWatch time is milliseconds.

Imports tell the translator which object is a motor, drive base, sensor, or hub. Constants such as `Port.A`, `Direction.COUNTERCLOCKWISE`, `Stop.HOLD`, and `Color.RED` become dropdowns.
