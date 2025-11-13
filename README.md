# Märklin-6050-and-6023-communication-documentation
> [!NOTE]
> This documentation can contain errors or have missing parts. If you find something please create an Issiue.

> [!TIP]
> Addionaly you can download an Webpage for testing all of these comands.
> Or test it here: [Märklin Intercace Controll](https://kamil00110.github.io/Maerklin-6050-and-6023-communication-documentation/)


This is an documutation that explains how the Märklin 6050/6051 and 6023/6223 comunicate

Both use serial comunication with the folowing specs:

## 6050:

- Baud: 2400
- Start bits: 1
- Word size: 8
- Stop bits: 2
- Parity: None

Uses only These Serial Pins:

- Pin1 = TX
- Pin2 = NC
- Pin3 = GND
- Pin4 = RX
- Pin5 = CTS
- Pin6 = NC

The 6050 communication functions by sending numbers in binary. Sending ascii values from the 6023 can freeze it. 
Which isn't a problem on systems using the Central unit 6020/6021/6022/6023/6223 because they will auto reset. 

The Central Unit 6027/6029/6030 will need a manual reset. Behaviour of 6032 is unkown yet.

Sending to a loco that is selected in a control 80f can crash the system.

(6223/6023/6022 will only accept loco adresses 10/20/30/40)

## Sending the data:

- Shutdown: `97`

- Start: `96`

- Turnout left(green): `33 X` <-- X stands for address `1-256`
  - example turnout 5 left: `33 5`

- Turnout right(red): `34 X` <-- X stands for address `1-256`
  - example turnout 7 right: `34 7`

- Turnout solenoid off: `32 X` <-- X stands for address `1-256` only needed in older central units
  - example turnout 75 off: `34 75`

- Change loco Direction: `15 X`  <-- X stands for address `1-80`
  - example loco 12 change direction: `15 12`

- Set loco Speed: `X Y` <-- X stands for speed `1-14`, Y stands for address `1-80`
  - exampe loco 23 speed 12: `12 23`

- Set loco Speed and Function: `X Y` <-- X stands for speed(`0-14`)+function (`+16=on +0=off`), Y stands for address `1-80`   can only be done this way.
  - exampe loco 31 speed 3 funktion 1: speed(3)+16: `20 31`

- Read s88 unit: `X` <-- X stands for `192+address(1-31)` 1 unit has 16 contacts. according to märklin 60128 software
  - example reed s88 module 5: `197`
  - response binary example `0`=unset `1`=set: `00110101 1000110`

- Read multiple s88 contacts: `X` <-- X stands for `128+address(1-31)`. according to märklin 60128 software
  - example reed s88 module 1-5: `133`
  - response binary example `0`=unset `1`=set: `"00110101 1000110" *5`

- Reset s88 units: `192 or 128`

- Call function F1-4: `X Y` <-- X stands for functioncode, Y stands for address `1-80`, no additiona speed information needed 
  - function codes:  //untested
    - `64`: all off
    - `65`: F1 on
    - `66`: F2 on
    - `67`: F1-2 on
    - `68`: F3 on
    - `69`: F1+F3 on
    - `70`: F2-3 on
    - `71`: F1-3 on
    - `72`: F4 on
    - `73`: F1+F4 on
    - `74`: F2+F4 on
    - `75`: F1+F2+F4 on
    - `76`: F3-4 on
    - `77`: F1+F3+F4 on
    - `78`: F2-4 on
    - `79`: F1-4 on
  - example loco 12 activate function F1-3: `71 12`

## 6023:
The 6023 is a newer system that wants ASCII commands it ignores the standart comands unless set into
compatibility mode which also deactivates ASCII comunication after each command a carrage retun(CR) is needed.
It is limmited to `4` s88 modules (`64 contacts`) and it auto shut offs solenoids after 200 milliseconds which can be changed

- Baud: 2400    //acording to some sources it can handle 19200 Baud couldn't check because of wrong and janky cable type.
- Start bits: 1
- Word size: 8
- Stop bits: 2
-Parity: None

Uses only These Serial Pins:

- Pin1 = TX
- Pin2 = Used but Unknown yet
- Pin3 = GND
- Pin4 = RX
- Pin5 = CTS
- Pin6 = Used but Unknown yet

## Sending the data:

- Bin Compatibility mode: `Q (CR)`

- Shutdown: `S (CR)`

- Start: `G (CR)`

- Turnout left(green): `M x G` <-- x stands for address `1-256`
  - example turnout 5 left: `M 5 G (CR)`

- Turnout right(red): `M x R` <-- x stands for address `1-256`
  - example turnout 7 right: `M 7 R (CR)`

- Change loco Direction: `L x D`  <-- x stands for address `1-80`
  - example loco 12 change direction: `L 12 D (CR)`

- Set loco Speed: `L x S y` <-- x stands for address `1-80`, y stands for speed `1-14`
  - exampe loco 23 speed 12: `L 23 S 12 (CR)`

- Set loco Speed and Function: `L x S y F z` <-- x stands for address `1-80`, y stands for speed `0-14`, z stands for function `0-1`
  - exampe loco 31 speed 3 funktion 1: `L 31 S 3 F 1 (CR)`

- Read s88 unit: `A x` <-- x stands for address `1-4` 1 unit has 16 contacts.
  - example reed s88 module 5: `A 4 (CR)`

- Read one s88 contact: `C x` <-- x stands for address `1-64`.
  - example reed s88 contact 5: `C 5 (CR)`

### Jobs:
The 6023 can be comanded to wait for and report if a specific contact is pressed.

- Echo mode: `E x` <-- x stands for the mode `0-2` it needs to be activated to get automatic responses.
  - exampe set echomode 2: `E 2`

- Report a s88 changes automaticly: `W x` <-- x stands for address `1-64`.   //untested
  - exampe auto report contact `17: W 17`

- wait until contact: `J x W y z` <-- x stands for Job number (`1-3`), y stands for contact, z stans for State `P/N` (Positive/Negative)   //untested
  - example Job 1 wait for contact 21 positive: `J 1 W 21 P (CR)`

- Kill Job: `K x` <-- x stands for Job number (`1-3`)   //untested
  - example Kill Job 3: `K 3 (CR)`




## Central unit depending functions:
- 6020: dosnt support `F1-4`
- 6021: supports `F1-4`
- 6022: dosnt support `F1-4`, only Train addresses `10`,`20`,`30`,`40`
- 6023/6223: dosnt support `F1-4`, only Train addresses `10`,`20`,`30`,`40`, has an integraded Serial Interface, only supports `4` s88 modules
- 6027: dcc support, supports `F1-4`, frezzes when to much data is sent
- 6028: dcc support, supports `F1-4`, frezzes when to much data is sent //untested but should be the same as `6027`
- 6030: dcc support; higher voltage for gauage 1 trains, supports `F1-4`, frezzes when to much data is sent //untested but should be the same as `6027`

## Aditional info 
Things that dont work: When a Control 80/80f or control unit has a loco address selected 
then it will be inpossible to controll the loco with a 6050 interface. It may even crash to 6027.

The interface modules are able to switch the Led on the 6040 Keyboard but they
can't recive data when somone uses the 6040 Keybord, Control 80/80f or Control Units externaly.

## Used bytes:

- 0-15 speed
- 16-31 function
- 32-34 switches
- 35-68 ???
- 64-79 F0-4
- 80-95 ???
- 96-97 Start/Stop
- 98-127 more start/stop?
- 128 reset
- 129-160 S88
- 161-191 ???
- 192 reset
- 193-224 S88
- 225+ ???
