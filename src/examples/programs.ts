export interface ExampleProgram {
  id: string;
  title: string;
  description: string;
  code: string;
}

export const STARTER_CODE = `# Welcome to BTP Translator.
# Open a file, paste Python, or pick an example on the left.
# Then press Translate.

from pybricks.parameters import Port
from pybricks.pupdevices import Motor
from pybricks.tools import wait

# A motor on port A.
example_motor = Motor(Port.A)
example_motor.run(500)
wait(1000)
example_motor.stop()
`;

export const EXAMPLES: ExampleProgram[] = [
  {
    id: 'motor',
    title: 'Motor movement',
    description: 'Create a motor and run it both ways.',
    code: `from pybricks.parameters import Port
from pybricks.pupdevices import Motor
from pybricks.tools import wait

# Initialize a motor on port A.
example_motor = Motor(Port.A)

# Run clockwise at 500 degrees per second.
example_motor.run(500)
wait(3000)

# Run the other way, then stop.
example_motor.run(-500)
wait(3000)
example_motor.stop()
`,
  },
  {
    id: 'drivebase',
    title: 'Drive base',
    description: 'Drive straight and turn using the current DriveBase API.',
    code: `from pybricks.parameters import Direction, Port
from pybricks.pupdevices import Motor
from pybricks.robotics import DriveBase

# The left motor must turn counterclockwise to drive forward.
left_motor = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right_motor = Motor(Port.B)

# Wheel diameter and axle track are millimetres.
drive_base = DriveBase(left_motor, right_motor, wheel_diameter=56, axle_track=112)
drive_base.straight(500)
drive_base.turn(180)
drive_base.straight(500)
drive_base.turn(-180)
`,
  },
  {
    id: 'variables',
    title: 'Variables and math',
    description: 'Names, arithmetic, and a condition.',
    code: `speed = 400
seconds = 2
distance = speed * seconds
steps = 3
if distance > 100 and steps > 0:
    speed = speed + 50
print(speed, distance)
`,
  },
  {
    id: 'nested-if',
    title: 'Nested if',
    description: 'if, elif, and else inside another if.',
    code: `from pybricks.parameters import Color, Port
from pybricks.pupdevices import ColorSensor, UltrasonicSensor

color_sensor = ColorSensor(Port.A)
eyes = UltrasonicSensor(Port.B)
distance = eyes.distance()
seen = color_sensor.color()

if distance < 200:
    if seen == Color.RED:
        print("red and close")
    elif seen == Color.BLUE:
        print("blue and close")
    else:
        print("close")
else:
    print("clear")
`,
  },
  {
    id: 'loops',
    title: 'Loops',
    description: 'A counted loop and a while loop.',
    code: `from pybricks.parameters import Port
from pybricks.pupdevices import Motor
from pybricks.tools import wait

example_motor = Motor(Port.A)
for count in range(5):
    example_motor.run_angle(400, 90)
    wait(200)

speed = 100
while speed < 500:
    example_motor.run(speed)
    speed = speed + 100
    if speed >= 400:
        break
example_motor.stop()
`,
  },
  {
    id: 'functions',
    title: 'Functions',
    description: 'Define a function, call it, and return a value.',
    code: `from pybricks.parameters import Port
from pybricks.pupdevices import Motor

arm = Motor(Port.A)

def move_arm(speed, angle):
    arm.run_angle(speed, angle)
    return angle

moved = move_arm(500, 180)
print(moved)
`,
  },
  {
    id: 'comments',
    title: 'Comments and docstrings',
    description: 'Notes stay visible after translation.',
    code: `"""Module note for the motor demo."""

from pybricks.parameters import Port
from pybricks.pupdevices import Motor

def spin():
    """Turn the motor one full rotation."""
    # 360 degrees at 500 deg/s.
    motor = Motor(Port.A)
    motor.run_angle(500, 360)

spin()
`,
  },
  {
    id: 'async',
    title: 'Async multitask',
    description: 'Run two motor actions at the same time.',
    code: `from pybricks.parameters import Port
from pybricks.pupdevices import Motor
from pybricks.tools import multitask, run_task

left = Motor(Port.A)
right = Motor(Port.B)

async def main():
    """Move both motors together."""
    await multitask(
        left.run_angle(500, 360),
        right.run_angle(500, -360),
    )

run_task(main())
`,
  },
  {
    id: 'sensors',
    title: 'Sensors and wait',
    description: 'Read a distance sensor and a force sensor.',
    code: `from pybricks.parameters import Port
from pybricks.pupdevices import ForceSensor, UltrasonicSensor
from pybricks.tools import wait

eyes = UltrasonicSensor(Port.A)
button = ForceSensor(Port.B)

while True:
    if eyes.distance() < 300:
        print(eyes.distance())
    if button.pressed():
        break
    wait(100)
`,
  },
  {
    id: 'hub',
    title: 'Hub light and sound',
    description: 'Prime Hub light, beep, and battery voltage.',
    code: `from pybricks.hubs import PrimeHub
from pybricks.parameters import Color
from pybricks.tools import wait

hub = PrimeHub()
hub.light.on(Color.RED)
hub.speaker.beep(440, 200)
wait(1000)
hub.light.off()
print(hub.battery.voltage())
`,
  },
  {
    id: 'unsupported',
    title: 'Unsupported syntax',
    description: 'Code that stays visible with a warning.',
    code: `class Robot:
    def __init__(self):
        self.speed = 100

try:
    value = Robot().speed
except Exception:
    value = 0

double = lambda n: n * 2
print(value)
`,
  },
];

export function exampleById(id: string): ExampleProgram | undefined {
  return EXAMPLES.find((example) => example.id === id);
}
