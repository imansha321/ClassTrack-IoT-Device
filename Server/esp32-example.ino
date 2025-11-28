// ESP32 Arduino Example Code for ClassTrack Integration
// This example shows how to integrate ESP32 with the ClassTrack backend

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

// WiFi credentials
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";

// Server configuration
const char *serverHost = "192.168.1.100"; // Your server IP
const uint16_t serverPort = 8080;         // WebSocket port

// Device configuration
const char *deviceId = "ESP32-101";
const char *room = "Room 101";

// Hardware components
WebSocketsClient webSocket;
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&Serial2);
Adafruit_BME280 bme;

// Timing
unsigned long lastStatusUpdate = 0;
unsigned long lastAirQualityUpdate = 0;
const unsigned long STATUS_INTERVAL = 60000;       // 1 minute
const unsigned long AIR_QUALITY_INTERVAL = 300000; // 5 minutes

void setup()
{
    Serial.begin(115200);

    // Connect to WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

    // Initialize fingerprint sensor
    Serial2.begin(57600);
    if (finger.verifyPassword())
    {
        Serial.println("Fingerprint sensor found!");
    }
    else
    {
        Serial.println("Fingerprint sensor not found!");
    }

    // Initialize BME280 sensor
    if (!bme.begin(0x76))
    {
        Serial.println("BME280 sensor not found!");
    }
    else
    {
        Serial.println("BME280 sensor initialized!");
    }

    // Connect to WebSocket
    webSocket.begin(serverHost, serverPort, "/");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

void loop()
{
    webSocket.loop();

    // Check for fingerprint
    if (checkFingerprint())
    {
        // Fingerprint detected and verified
    }

    // Send device status updates
    if (millis() - lastStatusUpdate > STATUS_INTERVAL)
    {
        sendDeviceStatus();
        lastStatusUpdate = millis();
    }

    // Send air quality updates
    if (millis() - lastAirQualityUpdate > AIR_QUALITY_INTERVAL)
    {
        sendAirQuality();
        lastAirQualityUpdate = millis();
    }
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
    switch (type)
    {
    case WStype_DISCONNECTED:
        Serial.println("[WebSocket] Disconnected");
        break;

    case WStype_CONNECTED:
        Serial.println("[WebSocket] Connected");
        break;

    case WStype_TEXT:
        Serial.printf("[WebSocket] Received: %s\n", payload);
        handleServerMessage((char *)payload);
        break;

    case WStype_ERROR:
        Serial.println("[WebSocket] Error");
        break;
    }
}

void handleServerMessage(char *message)
{
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error)
    {
        Serial.println("Failed to parse server message");
        return;
    }

    const char *status = doc["status"];
    Serial.printf("Server status: %s\n", status);
}

bool checkFingerprint()
{
    uint8_t p = finger.getImage();
    if (p != FINGERPRINT_OK)
        return false;

    p = finger.image2Tz();
    if (p != FINGERPRINT_OK)
        return false;

    p = finger.fingerFastSearch();
    if (p != FINGERPRINT_OK)
        return false;

    // Fingerprint matched!
    Serial.printf("Found ID #%d with confidence %d\n",
                  finger.fingerID, finger.confidence);

    // Send attendance data
    sendAttendance(finger.fingerID, finger.confidence);

    delay(3000); // Debounce
    return true;
}

void sendAttendance(uint16_t fingerprintId, uint16_t confidence)
{
    StaticJsonDocument<256> doc;

    doc["type"] = "attendance";
    doc["deviceId"] = deviceId;
    doc["studentId"] = String("STU") + String(fingerprintId, DEC).padStart(4, '0');
    doc["fingerprintMatch"] = true;
    doc["reliability"] = confidence;

    String json;
    serializeJson(doc, json);

    webSocket.sendTXT(json);
    Serial.println("Attendance sent: " + json);
}

void sendAirQuality()
{
    StaticJsonDocument<256> doc;

    // Read PM2.5 (example - use actual PM sensor)
    float pm25 = random(20, 60) + random(0, 100) / 100.0;

    // Read CO2 (example - use actual CO2 sensor)
    int co2 = random(400, 900);

    // Read BME280
    float temperature = bme.readTemperature();
    float humidity = bme.readHumidity();

    doc["type"] = "airquality";
    doc["deviceId"] = deviceId;
    doc["room"] = room;
    doc["pm25"] = pm25;
    doc["co2"] = co2;
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;

    String json;
    serializeJson(doc, json);

    webSocket.sendTXT(json);
    Serial.println("Air quality sent: " + json);
}

void sendDeviceStatus()
{
    StaticJsonDocument<256> doc;

    // Calculate battery percentage (example - use actual battery monitoring)
    int batteryLevel = random(70, 100);

    // Get WiFi signal strength
    int rssi = WiFi.RSSI();
    int signalStrength = map(rssi, -100, -40, 0, 100);
    signalStrength = constrain(signalStrength, 0, 100);

    // Calculate uptime
    unsigned long uptimeSeconds = millis() / 1000;
    unsigned long days = uptimeSeconds / 86400;

    doc["type"] = "device_status";
    doc["deviceId"] = deviceId;
    doc["battery"] = batteryLevel;
    doc["signal"] = signalStrength;
    doc["uptime"] = String(days) + " days";

    String json;
    serializeJson(doc, json);

    webSocket.sendTXT(json);
    Serial.println("Device status sent: " + json);
}

/*
 * Required Libraries (install via Arduino Library Manager):
 * - WebSockets by Markus Sattler
 * - ArduinoJson by Benoit Blanchon
 * - Adafruit Fingerprint Sensor Library
 * - Adafruit BME280 Library
 * - Adafruit Unified Sensor
 *
 * Wiring:
 * - Fingerprint Sensor: TX->GPIO17, RX->GPIO16
 * - BME280: SDA->GPIO21, SCL->GPIO22
 * - PM2.5 Sensor: Connect according to your sensor model
 * - CO2 Sensor: Connect according to your sensor model
 */
