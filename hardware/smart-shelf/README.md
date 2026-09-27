# Physical smart shelf: Arduino and HX711

## Parts:

1. Arduino Uno or compatible board.
2. HX711 amplifier.
3. Load cell rated for the shelf load.
4. Stable USB connection to the computer running ShelfSense.

## Wiring:

Connect HX711 `DT` to digital pin 4 and `SCK` to digital pin 5. Connect power and ground according to the HX711 board voltage. Follow the load cell colour mapping supplied by its manufacturer.

## Calibration:

Install the Arduino `HX711` library. Upload `smart_shelf.ino`, place a known weight on the shelf and adjust `CALIBRATION_FACTOR` until the printed grams match the known weight. Keep calibration values out of screenshots if they expose device details.

## Run:

Set `SERIAL_DEVICE` to the Arduino USB serial device. On macOS it normally starts with `/dev/cu.`. On Linux it normally starts with `/dev/ttyACM` or `/dev/ttyUSB`.

```bash
SERIAL_DEVICE=/dev/cu.usbmodem-example npm run hardware-gateway
```

The gateway validates each JSON line and publishes it to `shelfsense/raw/<store>/shelf/<shelfId>`. The physical shelf and the simulator therefore use the same Node-RED flow and business services.
