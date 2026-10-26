export type CategoryName =
  | 'Motors'
  | 'Drive base'
  | 'Sensors'
  | 'Hub'
  | 'Timing'
  | 'Pybricks'
  | 'Notes'
  | 'Functions';

export type EnumKind = 'port' | 'direction' | 'stop' | 'color' | 'button' | 'side' | 'axis' | 'bool';

export interface ParamSpec {
  name: string;
  input: string;
  unit?: string;
  optional?: boolean;
  enumKind?: EnumKind;
  defaultEnum?: string;
  defaultBool?: boolean;
  defaultNumber?: number;
  omitIfAbsent?: boolean;
}

export interface BlockSpec {
  key: string;
  block: string;
  category: CategoryName;
  colour: number;
  tooltip: string;
  docs: string;
  message: string;
  messages?: string[];
  receiver?: boolean;
  nameField?: boolean;
  params: ParamSpec[];
  output?: boolean;
  inline?: boolean;
}

export const MOTOR_DOCS = 'https://docs.pybricks.com/en/latest/pupdevices/motor.html';
export const DRIVE_DOCS = 'https://docs.pybricks.com/en/latest/robotics.html';
export const COLOR_DOCS = 'https://docs.pybricks.com/en/latest/pupdevices/colorsensor.html';
export const ULTRA_DOCS = 'https://docs.pybricks.com/en/latest/pupdevices/ultrasonicsensor.html';
export const FORCE_DOCS = 'https://docs.pybricks.com/en/latest/pupdevices/forcesensor.html';
export const HUB_DOCS = 'https://docs.pybricks.com/en/latest/hubs/primehub.html';
export const TOOLS_NOTE = 'pybricks.tools — wait() takes milliseconds. StopWatch.time() returns milliseconds.';

export const ENUM_OPTIONS: Record<Exclude<EnumKind, 'bool'>, string[]> = {
  port: ['A', 'B', 'C', 'D', 'E', 'F'],
  direction: ['CLOCKWISE', 'COUNTERCLOCKWISE'],
  stop: ['HOLD', 'BRAKE', 'COAST'],
  color: ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'VIOLET', 'MAGENTA', 'WHITE', 'BLACK', 'GRAY', 'NONE'],
  button: ['LEFT', 'CENTER', 'RIGHT'],
  side: ['TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'FRONT', 'BACK'],
  axis: ['X', 'Y', 'Z'],
};

const num = (name: string, input: string, unit?: string, optional = false): ParamSpec => ({ name, input, unit, optional });
const enumeration = (name: string, input: string, enumKind: Exclude<EnumKind, 'bool'>, defaultEnum?: string): ParamSpec => ({
  name,
  input,
  enumKind,
  optional: defaultEnum !== undefined,
  defaultEnum,
});
const flag = (name: string, input: string, defaultBool: boolean): ParamSpec => ({
  name,
  input,
  enumKind: 'bool',
  optional: true,
  defaultBool,
});

function method(
  key: string,
  block: string,
  category: CategoryName,
  colour: number,
  docs: string,
  tooltip: string,
  message: string,
  params: ParamSpec[],
  output = false,
): BlockSpec {
  return { key, block, category, colour, docs, tooltip, message, receiver: true, params, output, inline: true };
}

function named(
  key: string,
  block: string,
  category: CategoryName,
  colour: number,
  docs: string,
  tooltip: string,
  message: string,
  params: ParamSpec[],
  messages?: string[],
): BlockSpec {
  return { key, block, category, colour, docs, tooltip, message, messages, nameField: true, params, inline: !messages };
}

const MOTOR = 20;
const DRIVE = 130;
const SENSOR = 200;
const HUB = 45;
const TIME = 190;

export const BLOCK_SPECS: BlockSpec[] = [
  named('ctor:Motor', 'btp_motor_new', 'Motors', MOTOR, MOTOR_DOCS, 'Create a Pybricks motor. Port is A–F. Direction defaults to clockwise. Speed commands use degrees per second.', 'motor %1 = Motor port %2 direction %3', [
    enumeration('port', 'PORT', 'port'),
    enumeration('positive_direction', 'DIRECTION', 'direction', 'CLOCKWISE'),
  ]),
  named('ctor:Motor:full', 'btp_motor_new_full', 'Motors', MOTOR, MOTOR_DOCS, 'Create a motor and set gearing, angle reset, and the precision profile in degrees. Gears are a list such as 12, 36.', 'motor %1 = Motor port %2 direction %3', [
    enumeration('port', 'PORT', 'port'),
    enumeration('positive_direction', 'DIRECTION', 'direction', 'CLOCKWISE'),
    num('gears', 'GEARS', 'teeth', true),
    flag('reset_angle', 'RESET', true),
    num('profile', 'PROFILE', 'deg', true),
  ], ['motor %1 = Motor port %2 direction %3', 'gears %1 reset angle %2 profile %3 deg']),
  method('Motor.run', 'btp_motor_run', 'Motors', MOTOR, MOTOR_DOCS, 'Run the motor until another command. Speed is degrees per second.', 'run motor %1 at %2 deg/s', [num('speed', 'SPEED', 'deg/s')]),
  method('Motor.dc', 'btp_motor_dc', 'Motors', MOTOR, MOTOR_DOCS, 'Set the motor duty cycle, also called power, from -100 to 100 percent.', 'set motor %1 duty cycle to %2 %', [num('duty', 'DUTY', '%')]),
  method('Motor.run_time', 'btp_motor_run_time', 'Motors', MOTOR, MOTOR_DOCS, 'Run for a fixed time. Speed is deg/s and time is milliseconds. then says how to stop. wait waits before the next block.', 'run motor %1 at %2 deg/s for %3 ms then %4 wait %5', [
    num('speed', 'SPEED', 'deg/s'),
    num('time', 'TIME', 'ms'),
    enumeration('then', 'THEN', 'stop', 'HOLD'),
    flag('wait', 'WAIT', true),
  ]),
  method('Motor.run_angle', 'btp_motor_run_angle', 'Motors', MOTOR, MOTOR_DOCS, 'Run by an angle. Speed is deg/s and the angle is degrees.', 'run motor %1 at %2 deg/s by %3 deg then %4 wait %5', [
    num('speed', 'SPEED', 'deg/s'),
    num('rotation_angle', 'ANGLE', 'deg'),
    enumeration('then', 'THEN', 'stop', 'HOLD'),
    flag('wait', 'WAIT', true),
  ]),
  method('Motor.run_target', 'btp_motor_run_target', 'Motors', MOTOR, MOTOR_DOCS, 'Run to a target angle in degrees. The sign of the speed does not choose the direction.', 'run motor %1 at %2 deg/s to %3 deg then %4 wait %5', [
    num('speed', 'SPEED', 'deg/s'),
    num('target_angle', 'ANGLE', 'deg'),
    enumeration('then', 'THEN', 'stop', 'HOLD'),
    flag('wait', 'WAIT', true),
  ]),
  method('Motor.run_until_stalled', 'btp_motor_stall', 'Motors', MOTOR, MOTOR_DOCS, 'Run until the motor stalls. Speed is deg/s. then defaults to coast. Duty limit is a percent.', 'run motor %1 at %2 deg/s until stalled then %3 duty limit %4 %', [
    num('speed', 'SPEED', 'deg/s'),
    enumeration('then', 'THEN', 'stop', 'COAST'),
    { name: 'duty_limit', input: 'DUTY', unit: '%', optional: true, omitIfAbsent: true },
  ]),
  method('Motor.run_until_stalled#value', 'btp_motor_stall_value', 'Motors', MOTOR, MOTOR_DOCS, 'Run until stalled and get the angle in degrees where it stalled.', 'stalled angle of motor %1 at %2 deg/s then %3 duty limit %4 %', [
    num('speed', 'SPEED', 'deg/s'),
    enumeration('then', 'THEN', 'stop', 'COAST'),
    { name: 'duty_limit', input: 'DUTY', unit: '%', optional: true, omitIfAbsent: true },
  ], true),
  method('Motor.track_target', 'btp_motor_track', 'Motors', MOTOR, MOTOR_DOCS, 'Track a target angle in degrees as fast as possible.', 'track motor %1 to %2 deg', [num('target_angle', 'ANGLE', 'deg')]),
  method('Motor.stop', 'btp_motor_stop', 'Motors', MOTOR, MOTOR_DOCS, 'Stop the motor and let it spin freely.', 'stop motor %1', []),
  method('Motor.brake', 'btp_motor_brake', 'Motors', MOTOR, MOTOR_DOCS, 'Passively brake the motor.', 'brake motor %1', []),
  method('Motor.hold', 'btp_motor_hold', 'Motors', MOTOR, MOTOR_DOCS, 'Stop the motor and hold its angle.', 'hold motor %1', []),
  method('Motor.reset_angle', 'btp_motor_reset_angle', 'Motors', MOTOR, MOTOR_DOCS, 'Reset the measured angle. Leave the value empty to use the absolute marker.', 'reset angle of motor %1 to %2 deg', [
    { name: 'angle', input: 'ANGLE', unit: 'deg', optional: true, omitIfAbsent: true },
  ]),
  method('Motor.angle#value', 'btp_motor_angle', 'Motors', MOTOR, MOTOR_DOCS, 'Measured rotation angle in degrees.', 'angle of motor %1 deg', [], true),
  method('Motor.speed#value', 'btp_motor_speed', 'Motors', MOTOR, MOTOR_DOCS, 'Measured speed in degrees per second. window is the sample time in milliseconds and defaults to 100.', 'speed of motor %1 over %2 ms', [{ name: 'window', input: 'WINDOW', unit: 'ms', optional: true, defaultNumber: 100 }], true),
  method('Motor.load#value', 'btp_motor_load', 'Motors', MOTOR, MOTOR_DOCS, 'Estimated load torque in millinewton metres.', 'load of motor %1 mNm', [], true),
  method('Motor.stalled#value', 'btp_motor_stalled', 'Motors', MOTOR, MOTOR_DOCS, 'True when the motor cannot reach its target.', 'motor %1 stalled?', [], true),
  method('Motor.done#value', 'btp_motor_done', 'Motors', MOTOR, MOTOR_DOCS, 'True when the current motor command has finished.', 'motor %1 done?', [], true),
  method('Motor.settings', 'btp_motor_settings', 'Motors', MOTOR, MOTOR_DOCS, 'Set the maximum voltage in millivolts used by motor commands.', 'set motor %1 max voltage to %2 mV', [num('max_voltage', 'VOLTAGE', 'mV')]),
  method('Motor.close', 'btp_motor_close', 'Motors', MOTOR, MOTOR_DOCS, 'Close the motor so it can be created again.', 'close motor %1', []),

  named('ctor:DriveBase', 'btp_drivebase_new', 'Drive base', DRIVE, DRIVE_DOCS, 'Create a two-wheel drive base. Wheel diameter and axle track are millimetres. Positive distance is forward. Positive turn is right.', 'drive base %1 = DriveBase', [
    num('left_motor', 'LEFT'),
    num('right_motor', 'RIGHT'),
    num('wheel_diameter', 'DIAMETER', 'mm'),
    num('axle_track', 'TRACK', 'mm'),
  ], ['drive base %1 = DriveBase', 'left %1 right %2', 'wheel diameter %1 mm  axle track %2 mm']),
  method('DriveBase.straight', 'btp_db_straight', 'Drive base', DRIVE, DRIVE_DOCS, 'Drive straight. Distance is millimetres.', 'drive %1 straight %2 mm then %3 wait %4', [
    num('distance', 'DISTANCE', 'mm'),
    enumeration('then', 'THEN', 'stop', 'HOLD'),
    flag('wait', 'WAIT', true),
  ]),
  method('DriveBase.turn', 'btp_db_turn', 'Drive base', DRIVE, DRIVE_DOCS, 'Turn in place. Angle is degrees. Positive is right. absolute chooses a heading instead of a relative turn.', 'turn %1 by %2 deg then %3 wait %4 absolute %5', [
    num('angle', 'ANGLE', 'deg'),
    enumeration('then', 'THEN', 'stop', 'HOLD'),
    flag('wait', 'WAIT', true),
    flag('absolute', 'ABSOLUTE', false),
  ]),
  method('DriveBase.arc', 'btp_db_arc', 'Drive base', DRIVE, DRIVE_DOCS, 'Drive an arc. Radius, angle, and distance are millimetres or degrees. Use angle or distance, not both. Positive radius arcs to the right.', 'arc %1 radius %2 mm angle %3 deg distance %4 mm then %5 wait %6', [
    num('radius', 'RADIUS', 'mm'),
    { name: 'angle', input: 'ANGLE', unit: 'deg', optional: true, omitIfAbsent: true },
    { name: 'distance', input: 'DISTANCE', unit: 'mm', optional: true, omitIfAbsent: true },
    enumeration('then', 'THEN', 'stop', 'HOLD'),
    flag('wait', 'WAIT', true),
  ]),
  method('DriveBase.move_by', 'btp_db_move_by', 'Drive base', DRIVE, DRIVE_DOCS, 'Move by X and Y millimetres on the drive area. X is the starting forward direction. Y is to the left.', 'move %1 by x %2 mm y %3 mm then %4', [
    num('dx', 'DX', 'mm'),
    num('dy', 'DY', 'mm'),
    enumeration('then', 'THEN', 'stop', 'HOLD'),
  ]),
  method('DriveBase.drive', 'btp_db_drive', 'Drive base', DRIVE, DRIVE_DOCS, 'Start driving and keep going. Speed is millimetres per second. Turn rate is degrees per second.', 'start %1 at %2 mm/s turn %3 deg/s', [
    num('speed', 'SPEED', 'mm/s'),
    num('turn_rate', 'TURN', 'deg/s'),
  ]),
  method('DriveBase.stop', 'btp_db_stop', 'Drive base', DRIVE, DRIVE_DOCS, 'Stop the drive base and let the wheels spin freely.', 'stop drive base %1', []),
  method('DriveBase.brake', 'btp_db_brake', 'Drive base', DRIVE, DRIVE_DOCS, 'Passively brake the drive base.', 'brake drive base %1', []),
  method('DriveBase.hold', 'btp_db_hold', 'Drive base', DRIVE, DRIVE_DOCS, 'Stop and hold the drive base in place.', 'hold drive base %1', []),
  method('DriveBase.use_gyro', 'btp_db_gyro', 'Drive base', DRIVE, DRIVE_DOCS, 'Use the hub gyro for driving and turning when the value is true.', 'use gyro for %1 %2', [{ name: 'use_gyro', input: 'USE', enumKind: 'bool' }]),
  method('DriveBase.reset', 'btp_db_reset', 'Drive base', DRIVE, DRIVE_DOCS, 'Reset driven distance in millimetres and heading in degrees. This also stops the robot.', 'reset %1 distance %2 mm angle %3 deg', [
    { name: 'distance', input: 'DISTANCE', unit: 'mm', optional: true, defaultNumber: 0 },
    { name: 'angle', input: 'ANGLE', unit: 'deg', optional: true, defaultNumber: 0 },
  ]),
  method('DriveBase.settings', 'btp_db_settings', 'Drive base', DRIVE, DRIVE_DOCS, 'Set straight speed (mm/s), straight acceleration (mm/s²), turn rate (deg/s), and turn acceleration (deg/s²).', 'set %1 speed %2 mm/s accel %3 mm/s² turn %4 deg/s turn accel %5 deg/s²', [
    num('straight_speed', 'SPEED', 'mm/s'),
    num('straight_acceleration', 'ACCEL', 'mm/s²'),
    num('turn_rate', 'RATE', 'deg/s'),
    num('turn_acceleration', 'TURN_ACCEL', 'deg/s²'),
  ]),
  method('DriveBase.distance#value', 'btp_db_distance', 'Drive base', DRIVE, DRIVE_DOCS, 'Estimated driven distance in millimetres.', 'distance of %1 mm', [], true),
  method('DriveBase.angle#value', 'btp_db_angle', 'Drive base', DRIVE, DRIVE_DOCS, 'Estimated heading in degrees. Positive is clockwise.', 'angle of drive base %1 deg', [], true),
  method('DriveBase.done#value', 'btp_db_done', 'Drive base', DRIVE, DRIVE_DOCS, 'True when the current drive command has finished.', 'drive base %1 done?', [], true),
  method('DriveBase.stalled#value', 'btp_db_stalled', 'Drive base', DRIVE, DRIVE_DOCS, 'True when the drive base cannot reach its target.', 'drive base %1 stalled?', [], true),
  method('DriveBase.state#value', 'btp_db_state', 'Drive base', DRIVE, DRIVE_DOCS, 'Distance (mm), drive speed (mm/s), angle (deg), and turn rate (deg/s).', 'state of drive base %1', [], true),

  named('ctor:Car', 'btp_car_new', 'Drive base', DRIVE, DRIVE_DOCS, 'A vehicle with one steering motor and one or more drive motors. torque_limit is a percent and defaults to 100.', 'car %1 = Car steer %2 drive %3 torque limit %4 %', [
    num('steer_motor', 'STEER'),
    num('drive_motors', 'DRIVE'),
    { name: 'torque_limit', input: 'TORQUE', unit: '%', optional: true, defaultNumber: 100 },
  ]),
  method('Car.steer', 'btp_car_steer', 'Drive base', DRIVE, DRIVE_DOCS, 'Steer by a percent. 100 is full right, -100 is full left, 0 is straight.', 'steer car %1 by %2 %', [num('percentage', 'PERCENT', '%')]),
  method('Car.drive_power', 'btp_car_power', 'Drive base', DRIVE, DRIVE_DOCS, 'Drive at a power percent of the battery voltage. Positive is forward.', 'drive car %1 at power %2 %', [num('power', 'POWER', '%')]),
  method('Car.drive_speed', 'btp_car_speed', 'Drive base', DRIVE, DRIVE_DOCS, 'Drive at a motor speed in degrees per second.', 'drive car %1 at speed %2 deg/s', [num('speed', 'SPEED', 'deg/s')]),

  named('ctor:ColorSensor', 'btp_color_new', 'Sensors', SENSOR, COLOR_DOCS, 'Create a color sensor on a port.', 'color sensor %1 = ColorSensor port %2', [enumeration('port', 'PORT', 'port')]),
  method('ColorSensor.color#value', 'btp_color_color', 'Sensors', SENSOR, COLOR_DOCS, 'Detected color. surface true reads an object. surface false reads an external light.', 'color seen by %1 surface %2', [flag('surface', 'SURFACE', true)], true),
  method('ColorSensor.reflection#value', 'btp_color_reflection', 'Sensors', SENSOR, COLOR_DOCS, 'Reflected light from 0 to 100 percent.', 'reflection of %1 %', [], true),
  method('ColorSensor.ambient#value', 'btp_color_ambient', 'Sensors', SENSOR, COLOR_DOCS, 'Ambient light from 0 to 100 percent.', 'ambient light of %1 %', [], true),
  method('ColorSensor.hsv#value', 'btp_color_hsv', 'Sensors', SENSOR, COLOR_DOCS, 'Hue (0–359), saturation (0–100), and brightness (0–100).', 'HSV of %1 surface %2', [flag('surface', 'SURFACE', true)], true),
  method('ColorSensor.detectable_colors', 'btp_color_detect', 'Sensors', SENSOR, COLOR_DOCS, 'Choose which colors color() may return.', 'set detectable colors of %1 to %2', [num('colors', 'COLORS')]),
  method('ColorLights.on', 'btp_color_lights_on', 'Sensors', SENSOR, COLOR_DOCS, 'Turn on the color sensor lights. One number sets every light. Three numbers set each light, in percent.', 'lights of %1 on at %2 %', [num('brightness', 'BRIGHTNESS', '%')]),
  method('ColorLights.off', 'btp_color_lights_off', 'Sensors', SENSOR, COLOR_DOCS, 'Turn off the color sensor lights.', 'lights of %1 off', []),

  named('ctor:UltrasonicSensor', 'btp_ultra_new', 'Sensors', SENSOR, ULTRA_DOCS, 'Create an ultrasonic distance sensor on a port.', 'ultrasonic sensor %1 = UltrasonicSensor port %2', [enumeration('port', 'PORT', 'port')]),
  method('UltrasonicSensor.distance#value', 'btp_ultra_distance', 'Sensors', SENSOR, ULTRA_DOCS, 'Distance in millimetres. 2000 means no valid reading.', 'distance of %1 mm', [], true),
  method('UltrasonicSensor.presence#value', 'btp_ultra_presence', 'Sensors', SENSOR, ULTRA_DOCS, 'True when another ultrasonic sensor is heard.', 'ultrasonic presence at %1', [], true),
  method('UltraLights.on', 'btp_ultra_lights_on', 'Sensors', SENSOR, ULTRA_DOCS, 'Turn on the four ultrasonic lights. Brightness is a percent, or four percents.', 'lights of %1 on at %2 %', [num('brightness', 'BRIGHTNESS', '%')]),
  method('UltraLights.off', 'btp_ultra_lights_off', 'Sensors', SENSOR, ULTRA_DOCS, 'Turn off the ultrasonic lights.', 'ultrasonic lights of %1 off', []),

  named('ctor:ForceSensor', 'btp_force_new', 'Sensors', SENSOR, FORCE_DOCS, 'Create a force sensor on a port.', 'force sensor %1 = ForceSensor port %2', [enumeration('port', 'PORT', 'port')]),
  method('ForceSensor.force#value', 'btp_force_force', 'Sensors', SENSOR, FORCE_DOCS, 'Force in newtons, up to about 10 N.', 'force of %1 N', [], true),
  method('ForceSensor.distance#value', 'btp_force_distance', 'Sensors', SENSOR, FORCE_DOCS, 'How far the button has moved, in millimetres.', 'press distance of %1 mm', [], true),
  method('ForceSensor.pressed#value', 'btp_force_pressed', 'Sensors', SENSOR, FORCE_DOCS, 'True when the button is pressed. The default threshold is 3 newtons.', 'force sensor %1 pressed above %2 N', [{ name: 'force', input: 'FORCE', unit: 'N', optional: true, defaultNumber: 3 }], true),
  method('ForceSensor.touched#value', 'btp_force_touched', 'Sensors', SENSOR, FORCE_DOCS, 'True when the button is touched, even if the force is still near zero.', 'force sensor %1 touched?', [], true),

  named('ctor:PrimeHub', 'btp_hub_new', 'Hub', HUB, HUB_DOCS, 'Create a Prime Hub or Inventor Hub. They are the same class. top_side defaults to Axis.Z and front_side defaults to Axis.X.', 'hub %1 = PrimeHub', []),
  named('ctor:PrimeHub:full', 'btp_hub_new_full', 'Hub', HUB, HUB_DOCS, 'Create a Prime Hub and say which way the top and front point.', 'hub %1 = PrimeHub top %2 front %3', [
    enumeration('top_side', 'TOP', 'axis', 'Z'),
    enumeration('front_side', 'FRONT', 'axis', 'X'),
  ]),
  named('ctor:InventorHub', 'btp_inventor_new', 'Hub', HUB, HUB_DOCS, 'Inventor Hub uses the same blocks as Prime Hub.', 'hub %1 = InventorHub', []),
  named('ctor:InventorHub:full', 'btp_inventor_new_full', 'Hub', HUB, HUB_DOCS, 'Create an Inventor Hub and set its orientation.', 'hub %1 = InventorHub top %2 front %3', [
    enumeration('top_side', 'TOP', 'axis', 'Z'),
    enumeration('front_side', 'FRONT', 'axis', 'X'),
  ]),
  method('HubLight.on', 'btp_light_on', 'Hub', HUB, HUB_DOCS, 'Turn the hub status light on.', 'light of %1 on %2', [enumeration('color', 'COLOR', 'color')]),
  method('HubLight.off', 'btp_light_off', 'Hub', HUB, HUB_DOCS, 'Turn the hub status light off.', 'light of %1 off', []),
  method('HubLight.blink', 'btp_light_blink', 'Hub', HUB, HUB_DOCS, 'Blink the status light. durations is a list of on and off times in milliseconds.', 'blink light of %1 color %2 durations %3 ms', [
    enumeration('color', 'COLOR', 'color'),
    num('durations', 'DURATIONS', 'ms'),
  ]),
  method('HubLight.animate', 'btp_light_animate', 'Hub', HUB, HUB_DOCS, 'Animate the status light through colors. interval is milliseconds.', 'animate light of %1 colors %2 every %3 ms', [
    num('colors', 'COLORS'),
    num('interval', 'INTERVAL', 'ms'),
  ]),
  method('HubDisplay.off', 'btp_display_off', 'Hub', HUB, HUB_DOCS, 'Turn off every pixel on the hub display.', 'display of %1 off', []),
  method('HubDisplay.number', 'btp_display_number', 'Hub', HUB, HUB_DOCS, 'Show a number from -99 to 99.', 'show number %2 on display of %1', [num('number', 'NUMBER')]),
  method('HubDisplay.char', 'btp_display_char', 'Hub', HUB, HUB_DOCS, 'Show one character on the 5×5 display.', 'show character %2 on display of %1', [num('char', 'CHAR')]),
  method('HubDisplay.text', 'btp_display_text', 'Hub', HUB, HUB_DOCS, 'Show text one character at a time. on and off are milliseconds and default to 500 and 50.', 'show text %2 on display of %1 on %3 ms off %4 ms', [
    num('text', 'TEXT'),
    { name: 'on', input: 'ON', unit: 'ms', optional: true, defaultNumber: 500 },
    { name: 'off', input: 'OFF', unit: 'ms', optional: true, defaultNumber: 50 },
  ]),
  method('HubDisplay.pixel', 'btp_display_pixel', 'Hub', HUB, HUB_DOCS, 'Light one pixel. Row and column start at 0. Brightness is a percent and defaults to 100.', 'pixel of %1 row %2 column %3 brightness %4 %', [
    num('row', 'ROW'),
    num('column', 'COLUMN'),
    { name: 'brightness', input: 'BRIGHTNESS', unit: '%', optional: true, defaultNumber: 100 },
  ]),
  method('HubDisplay.orientation', 'btp_display_orientation', 'Hub', HUB, HUB_DOCS, 'Choose which side of the display is up.', 'set display of %1 up side to %2', [enumeration('up', 'UP', 'side')]),
  method('HubSpeaker.beep', 'btp_beep', 'Hub', HUB, HUB_DOCS, 'Play a beep. Frequency is hertz (default 500). Duration is milliseconds (default 100).', 'beep on %1 at %2 Hz for %3 ms', [
    { name: 'frequency', input: 'FREQUENCY', unit: 'Hz', optional: true, defaultNumber: 500 },
    { name: 'duration', input: 'DURATION', unit: 'ms', optional: true, defaultNumber: 100 },
  ]),
  method('HubSpeaker.play_notes', 'btp_notes', 'Hub', HUB, HUB_DOCS, 'Play notes such as C4/4. Tempo is beats per minute and defaults to 120.', 'play notes %2 on %1 at tempo %3', [
    num('notes', 'NOTES'),
    { name: 'tempo', input: 'TEMPO', unit: 'bpm', optional: true, defaultNumber: 120 },
  ]),
  method('HubSpeaker.volume', 'btp_volume_set', 'Hub', HUB, HUB_DOCS, 'Set the speaker volume from 0 to 100 percent.', 'set volume of %1 to %2 %', [num('volume', 'VOLUME', '%')]),
  method('HubSpeaker.volume#value', 'btp_volume_get', 'Hub', HUB, HUB_DOCS, 'Current speaker volume in percent.', 'volume of %1 %', [], true),
  method('HubButtons.pressed#value', 'btp_buttons', 'Hub', HUB, HUB_DOCS, 'The set of hub buttons that are pressed right now.', 'buttons pressed on %1', [], true),
  method('HubImu.ready#value', 'btp_imu_ready', 'Hub', HUB, HUB_DOCS, 'True when the gyro has calibrated.', 'IMU of %1 ready?', [], true),
  method('HubImu.stationary#value', 'btp_imu_still', 'Hub', HUB, HUB_DOCS, 'True when the hub has been still for at least a second.', 'IMU of %1 stationary?', [], true),
  method('HubImu.heading#value', 'btp_imu_heading', 'Hub', HUB, HUB_DOCS, 'Heading in degrees since the program started. Positive is clockwise.', 'heading of %1 deg', [], true),
  method('HubImu.reset_heading', 'btp_imu_reset', 'Hub', HUB, HUB_DOCS, 'Reset the heading to an angle in degrees. Stop a drive base that is using the gyro first.', 'reset heading of %1 to %2 deg', [num('angle', 'ANGLE', 'deg')]),
  method('HubImu.up#value', 'btp_imu_up', 'Hub', HUB, HUB_DOCS, 'Which side of the hub faces up.', 'up side of %1 calibrated %2', [flag('calibrated', 'CALIBRATED', true)], true),
  method('HubBattery.voltage#value', 'btp_battery_voltage', 'Hub', HUB, HUB_DOCS, 'Battery voltage in millivolts.', 'battery voltage of %1 mV', [], true),
  method('HubBattery.current#value', 'btp_battery_current', 'Hub', HUB, HUB_DOCS, 'Battery current in milliamps.', 'battery current of %1 mA', [], true),
  method('HubSystem.shutdown', 'btp_shutdown', 'Hub', HUB, HUB_DOCS, 'Turn the hub off.', 'shut down %1', []),
  method('HubSystem.set_stop_button', 'btp_stop_button', 'Hub', HUB, HUB_DOCS, 'Choose the button that stops a program, or None to disable it.', 'set stop button of %1 to %2', [num('button', 'BUTTON')]),

  named('ctor:StopWatch', 'btp_watch_new', 'Timing', TIME, TOOLS_NOTE, 'Create a stopwatch. time() returns elapsed milliseconds.', 'stopwatch %1 = StopWatch', []),
  method('StopWatch.time#value', 'btp_watch_time', 'Timing', TIME, TOOLS_NOTE, 'Elapsed time in milliseconds.', 'time of stopwatch %1 ms', [], true),
  method('StopWatch.reset', 'btp_watch_reset', 'Timing', TIME, TOOLS_NOTE, 'Reset the stopwatch to zero.', 'reset stopwatch %1', []),
  method('StopWatch.pause', 'btp_watch_pause', 'Timing', TIME, TOOLS_NOTE, 'Pause the stopwatch.', 'pause stopwatch %1', []),
  method('StopWatch.resume', 'btp_watch_resume', 'Timing', TIME, TOOLS_NOTE, 'Resume the stopwatch.', 'resume stopwatch %1', []),
  {
    key: 'func:wait',
    block: 'btp_wait',
    category: 'Timing',
    colour: TIME,
    docs: TOOLS_NOTE,
    tooltip: 'Pause the program. The time is in milliseconds.',
    message: 'wait %1 ms',
    params: [num('time', 'TIME', 'ms')],
    inline: true,
  },
];

export const MODULE_EXPORTS: Record<string, Record<string, string>> = {
  'pybricks.pupdevices': {
    Motor: 'class:Motor',
    ColorSensor: 'class:ColorSensor',
    UltrasonicSensor: 'class:UltrasonicSensor',
    ForceSensor: 'class:ForceSensor',
  },
  'pybricks.robotics': {
    DriveBase: 'class:DriveBase',
    Car: 'class:Car',
  },
  'pybricks.hubs': {
    PrimeHub: 'class:PrimeHub',
    InventorHub: 'class:InventorHub',
    EssentialHub: 'class:EssentialHub',
    TechnicHub: 'class:TechnicHub',
    MoveHub: 'class:MoveHub',
    CityHub: 'class:CityHub',
  },
  'pybricks.parameters': {
    Port: 'enum:Port',
    Direction: 'enum:Direction',
    Stop: 'enum:Stop',
    Color: 'enum:Color',
    Button: 'enum:Button',
    Side: 'enum:Side',
    Axis: 'enum:Axis',
  },
  'pybricks.tools': {
    wait: 'func:wait',
    StopWatch: 'class:StopWatch',
    multitask: 'func:multitask',
    run_task: 'func:run_task',
  },
};

export const COMPONENTS: Record<string, Record<string, string>> = {
  PrimeHub: {
    light: 'HubLight',
    display: 'HubDisplay',
    speaker: 'HubSpeaker',
    buttons: 'HubButtons',
    imu: 'HubImu',
    battery: 'HubBattery',
    system: 'HubSystem',
  },
  InventorHub: {
    light: 'HubLight',
    display: 'HubDisplay',
    speaker: 'HubSpeaker',
    buttons: 'HubButtons',
    imu: 'HubImu',
    battery: 'HubBattery',
    system: 'HubSystem',
  },
  ColorSensor: { lights: 'ColorLights' },
  UltrasonicSensor: { lights: 'UltraLights' },
};

const SPEC_BY_KEY = new Map<string, BlockSpec>();
for (const spec of BLOCK_SPECS) {
  if (SPEC_BY_KEY.has(spec.key)) throw new Error(`Duplicate block spec ${spec.key}`);
  SPEC_BY_KEY.set(spec.key, spec);
}

export function specByKey(key: string): BlockSpec | undefined {
  return SPEC_BY_KEY.get(key);
}

export function placeholderCount(message: string): number {
  return message.match(/%\d+/g)?.length ?? 0;
}

export function specArgumentCount(spec: BlockSpec): number {
  return (spec.nameField ? 1 : 0) + (spec.receiver ? 1 : 0) + spec.params.length;
}

export function definitionFromSpec(spec: BlockSpec): Record<string, unknown> {
  const args: Record<string, unknown>[] = [];
  if (spec.nameField) args.push({ type: 'field_input', name: 'NAME', text: 'item' });
  if (spec.receiver) args.push({ type: 'field_input', name: 'RECEIVER', text: 'device' });
  for (const param of spec.params) args.push({ type: 'input_value', name: param.input });
  const messages = spec.messages ?? [spec.message];
  const init: Record<string, unknown> = {
    type: spec.block,
    colour: spec.colour,
    tooltip: spec.tooltip,
    inputsInline: spec.inline !== false,
  };
  let cursor = 0;
  messages.forEach((message, index) => {
    const count = placeholderCount(message);
    init[`message${index}`] = message;
    init[`args${index}`] = args.slice(cursor, cursor + count);
    cursor += count;
  });
  if (spec.output) init.output = null;
  else {
    init.previousStatement = null;
    init.nextStatement = null;
  }
  return init;
}

export function assertSpecMessages(spec: BlockSpec): void {
  const messages = spec.messages ?? [spec.message];
  const slots = messages.reduce((sum, message) => sum + placeholderCount(message), 0);
  if (slots !== specArgumentCount(spec)) {
    throw new Error(`${spec.block} has ${slots} placeholders and ${specArgumentCount(spec)} arguments`);
  }
}

for (const spec of BLOCK_SPECS) assertSpecMessages(spec);

export interface Capability {
  group: string;
  title: string;
  support: 'supported' | 'partial' | 'kept';
  detail: string;
}

export function capabilityList(): Capability[] {
  const syntax: Capability[] = [
    { group: 'Python', title: 'Variables and arithmetic', support: 'supported', detail: 'Assignments, updates, numbers, strings, lists, and + - * / // % **.' },
    { group: 'Python', title: 'if, elif, and else', support: 'supported', detail: 'Including nested conditions and comparison chains such as 0 < x < 10.' },
    { group: 'Python', title: 'for and while loops', support: 'supported', detail: 'range, lists, break, and continue. Loop else clauses are kept as source.' },
    { group: 'Python', title: 'Functions', support: 'supported', detail: 'Definitions, calls, return, and async def. Default values are kept in a note.' },
    { group: 'Python', title: 'Comments and docstrings', support: 'supported', detail: 'Comments stay attached to blocks. Docstrings stay visible as notes.' },
    { group: 'Python', title: 'await, multitask, and run_task', support: 'supported', detail: 'Supported Pybricks multitasking calls become blocks.' },
    { group: 'Python', title: 'Classes, try, with, lambda, comprehensions', support: 'kept', detail: 'The original source stays in the workspace with a warning. It is not deleted.' },
    { group: 'Direction', title: 'Python to Blockly', support: 'supported', detail: 'Translate reads Python and fills the Blockly workspace. Editing blocks does not rewrite the Python file.' },
  ];
  const api = BLOCK_SPECS.filter((spec) => !spec.key.endsWith('#value') && !spec.key.endsWith(':full')).map((spec) => ({
    group: spec.category,
    title: spec.key.replace('ctor:', '').replace('func:', ''),
    support: 'supported' as const,
    detail: spec.tooltip,
  }));
  return [...syntax, ...api];
}
