#include <HX711.h>

const int HX711_DATA_PIN = 4;
const int HX711_CLOCK_PIN = 5;
const char STORE_ID[] = "store-01";
const char SHELF_ID[] = "physical-01";
const char SKU_ID[] = "milk-1l";
const char DEVICE_ID[] = "arduino-01";
const float CALIBRATION_FACTOR = -7050.0;
const unsigned long SAMPLE_INTERVAL_MS = 500;

HX711 scale;
unsigned long lastSampleAt = 0;

void setup() {
  Serial.begin(115200);
  scale.begin(HX711_DATA_PIN, HX711_CLOCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR);
  scale.tare();
}

void loop() {
  const unsigned long now = millis();
  if (now - lastSampleAt < SAMPLE_INTERVAL_MS || !scale.is_ready()) return;
  lastSampleAt = now;
  const float grams = max(0.0f, scale.get_units(10) * 1000.0f);
  Serial.print("{\"store\":\"");
  Serial.print(STORE_ID);
  Serial.print("\",\"shelfId\":\"");
  Serial.print(SHELF_ID);
  Serial.print("\",\"skuId\":\"");
  Serial.print(SKU_ID);
  Serial.print("\",\"grams\":");
  Serial.print(grams, 1);
  Serial.print(",\"ts\":");
  Serial.print(now);
  Serial.print(",\"deviceId\":\"");
  Serial.print(DEVICE_ID);
  Serial.println("\"}");
}
