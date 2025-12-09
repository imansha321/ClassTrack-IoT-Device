#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiManager.h>

// -------------------- Pins & Interfaces --------------------
HardwareSerial FingerSerial(2); // Serial2
const int MQ135_PIN = 34;       // MQ135 analog pin
#define OLED_I2C_ADDR 0x3C
Adafruit_SH1106G display(128, 64, &Wire, -1);

Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FingerSerial);
uint8_t fingerResult;
int fingerID;
int fingerConfidence;
uint16_t nextEnrollId = 1;

const int ENROLL_BUTTON_PIN = 13;
bool enrollRequested = false;
bool enrollInProgress = false;
bool idleScreenDrawn = false;

// Debounce
unsigned long lastBtnMs = 0;
const unsigned long BTN_DEBOUNCE_MS = 200;

// WiFi / Backend
String deviceId = "a09a224d50";

// Avoid trailing slash to prevent double slashes when building URLs
const char *serverBase = "https://44cfef9f5433.ngrok-free.app";

// Timing
unsigned long lastAQMs = 0;
const unsigned long AQ_INTERVAL_MS = 5000;
unsigned long lastAttendancePostMs = 0;
const unsigned long ATTENDANCE_COOLDOWN_MS = 3000;

// UI

struct EnrollmentJob
{
    bool active;
    String id;
    String studentName;
    String studentCode;
    String classLabel;
};

EnrollmentJob currentEnrollment{false, "", "", "", ""};
unsigned long lastEnrollmentPollMs = 0;
const unsigned long ENROLLMENT_POLL_MS = 6000;
String lastEnrollError = "";
unsigned long lastTemplateSyncMs = 0;
const unsigned long TEMPLATE_SYNC_MS = 60000;

struct DeviceProfile
{
    String name;
    String location;
    String classLabel;
    String status;
};

DeviceProfile deviceProfile{"", "", "", "OFFLINE"};

// -------------------- Function Prototypes --------------------
void oledHeader(const char *title);
void oledFooter(const char *msg);
void showFingerprintStatus(const char *status, int id = -1, int confidence = -1, const char *title = "Fingerprint");
int readMQ135Raw();
float mq135Percent(int raw);
float mq135PseudoPPM(int raw);
int getFingerprintID();
bool enrollFingerprint(uint16_t id, const char *titleOverride = nullptr);
void IRAM_ATTR isrEnroll();
void IRAM_ATTR isrNext();
void IRAM_ATTR isrPrev();
void IRAM_ATTR isrAction();
void setupWiFi();
void postAttendance(uint16_t fingerprintId, int confidence);
void postAirQuality(int raw);
void postDeviceStatus();
void attachAuthHeaders(HTTPClient &http);
void pollEnrollmentQueue();
bool fetchNextEnrollmentJob(EnrollmentJob &job);
void showEnrollmentPrompt(const EnrollmentJob &job);
bool sendEnrollmentComplete(const EnrollmentJob &job, uint16_t slotId);
void reportEnrollmentFailure(const EnrollmentJob &job, const String &reason);
void clearEnrollmentJob();
String extractJsonValue(const String &json, const String &key);
String extractNestedJsonValue(const String &json, const String &sectionKey, const String &fieldKey);
String formatClassLabel(const String &room, const String &grade, const String &section);
void showIdleScreen();
void updateDeviceProfileFromJson(const String &json);
void showAttendanceConfirmation(const String &name, const String &studentCode, uint16_t fingerprintId, int confidence);
void syncTemplatesWithServer();
bool parseTemplateAllowList(const String &json, bool allowed[], size_t maxSlots);

// -------------------- Helper Functions --------------------
// Interrupt flags
volatile bool enrollIRQ = false;
volatile bool cancelEnrollIRQ = false;

void IRAM_ATTR isrEnroll()
{
    // If already enrolling, treat second press as cancel request
    if (enrollInProgress)
        cancelEnrollIRQ = true;
    else
        enrollIRQ = true;
}

void oledHeader(const char *title)
{
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(0, 0);
    display.println(title);
    display.drawLine(0, 10, 127, 10, SH110X_WHITE);
}

void oledFooter(const char *msg)
{
    display.setCursor(0, 56);
    display.println(msg);
}

void showFingerprintStatus(const char *status, int id, int confidence, const char *title)
{
    idleScreenDrawn = false;
    oledHeader(title);
    display.setCursor(0, 16);
    display.print("Status: ");
    display.println(status);
    if (id >= 0)
    {
        display.setCursor(0, 28);
        display.print("ID: ");
        display.println(id);
    }
    if (confidence >= 0)
    {
        display.setCursor(0, 40);
        display.print("Conf: ");
        display.println(confidence);
    }
    oledFooter("Place finger...");
    display.display();
}

int readMQ135Raw()
{
    return analogRead(MQ135_PIN);
}

float mq135Percent(int raw)
{
    return (raw / 4095.0f) * 100.0f;
}

float mq135PseudoPPM(int raw)
{
    return 350.0f + (raw / 4095.0f) * 700.0f;
}

int getFingerprintID()
{
    fingerResult = finger.getImage();
    if (fingerResult != FINGERPRINT_OK)
        return -1;
    fingerResult = finger.image2Tz();
    if (fingerResult != FINGERPRINT_OK)
        return -1;
    fingerResult = finger.fingerFastSearch();
    if (fingerResult != FINGERPRINT_OK)
        return -1;
    fingerID = finger.fingerID;
    fingerConfidence = finger.confidence;
    return fingerID;
}

bool enrollFingerprint(uint16_t id, const char *titleOverride)
{
    lastEnrollError = "";
    enrollInProgress = true;
    const char *uiTitle = (titleOverride && strlen(titleOverride) > 0) ? titleOverride : "Fingerprint";
    showFingerprintStatus("ENROLL", id, -1, uiTitle);
    Serial.printf("Starting enrollment for ID %u\n", id);
    while (finger.getImage() != FINGERPRINT_OK)
        delay(50);
    if (cancelEnrollIRQ)
    {
        cancelEnrollIRQ = false;
        enrollInProgress = false;
        Serial.println("Enroll canceled (stage 1)");
        lastEnrollError = "Cancelled";
        showFingerprintStatus("CANCELLED", -1, -1, uiTitle);
        delay(800);
        return false;
    }
    if (finger.image2Tz(1) != FINGERPRINT_OK)
    {
        Serial.println("image2Tz(1) failed");
        enrollInProgress = false;
        lastEnrollError = "image2Tz(1)";
        return false;
    }
    // Duplicate check: try searching existing templates after first conversion
    if (finger.fingerFastSearch() == FINGERPRINT_OK)
    {
        // Found a match – do NOT enroll again
        Serial.printf("Duplicate fingerprint detected (ID=%d). Aborting enrollment.\n", finger.fingerID);
        lastEnrollError = "Duplicate";
        showFingerprintStatus("DUPLICATE", finger.fingerID, finger.confidence, uiTitle);
        delay(1200);
        enrollInProgress = false;
        showIdleScreen();
        return false;
    }
    display.setCursor(0, 48);
    display.println("Remove finger");
    display.display();
    while (finger.getImage() != FINGERPRINT_NOFINGER)
        delay(50);
    display.setCursor(0, 48);
    display.println("Place again  ");
    display.display();
    while (finger.getImage() != FINGERPRINT_OK)
        delay(50);
    if (cancelEnrollIRQ)
    {
        cancelEnrollIRQ = false;
        enrollInProgress = false;
        Serial.println("Enroll canceled (stage 2)");
        lastEnrollError = "Cancelled";
        showFingerprintStatus("CANCELLED", -1, -1, uiTitle);
        delay(800);
        return false;
    }
    if (finger.image2Tz(2) != FINGERPRINT_OK)
    {
        Serial.println("image2Tz(2) failed");
        enrollInProgress = false;
        lastEnrollError = "image2Tz(2)";
        return false;
    }
    if (finger.createModel() != FINGERPRINT_OK)
    {
        Serial.println("createModel failed");
        enrollInProgress = false;
        lastEnrollError = "createModel";
        return false;
    }
    // Optional second duplicate check before storing (some sensors support model search)
    // If supported, you could load model and compare; here we proceed to store.
    if (finger.storeModel(id) != FINGERPRINT_OK)
    {
        Serial.println("storeModel failed");
        enrollInProgress = false;
        lastEnrollError = "storeModel";
        return false;
    }
    Serial.println("Enrollment success!");
    showFingerprintStatus("ENROLLED", id, -1, uiTitle);
    delay(1500);
    enrollInProgress = false;
    lastEnrollError = "";
    return true;
}

void setupWiFi()
{
    WiFi.mode(WIFI_STA);
    WiFiManager wm;
    wm.setTimeout(180);

    // Optional: parameter for server base URL
    // char serverBuf[64];
    // strlcpy(serverBuf, serverBase, sizeof(serverBuf));
    // WiFiManagerParameter pServer("serverBase", "Server Base (e.g. http://ip:5000)", serverBuf, 63);
    // wm.addParameter(&pServer);

    if (!wm.autoConnect("ClassTrack-Setup"))
    {
        Serial.println("WiFiManager timeout, restarting");
        ESP.restart();
    }

    Serial.print("Connected. IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Device ID: ");
    Serial.println(deviceId);
}

void postAttendance(uint16_t fingerprintId, int confidence)
{
    if (WiFi.status() != WL_CONNECTED)
        return;
    if (millis() - lastAttendancePostMs < ATTENDANCE_COOLDOWN_MS)
        return;
    lastAttendancePostMs = millis();
    HTTPClient http;
    String url = String(serverBase) + "/api/attendance/device";
    http.begin(url);
    attachAuthHeaders(http);
    // Send the fingerprint slot so backend can resolve student; include reliability score
    String payload = String("{\"fingerprintId\":") + fingerprintId + ",\"fingerprintMatch\":true,\"reliability\":" + confidence + "}";
    int code = http.POST(payload);
    String response = http.getString();
    Serial.printf("Attendance POST code=%d\n", code);
    if (response.length())
    {
        Serial.println("Attendance response:");
        Serial.println(response);
    }
    http.end();

    if (code >= 200 && code < 300)
    {
        String studentName = extractNestedJsonValue(response, "\"student\":{", "\"name\":\"");
        String studentCode = extractNestedJsonValue(response, "\"student\":{", "\"studentId\":\"");
        showAttendanceConfirmation(studentName, studentCode, fingerprintId, confidence);
    }
    else if (code == 404)
    {
        showFingerprintStatus("STUDENT MISSING", fingerprintId, confidence, "Attendance");
    }
    else
    {
        showFingerprintStatus("SERVER ERROR", fingerprintId, confidence, "Attendance");
    }
}

void postAirQuality(int raw)
{
    if (WiFi.status() != WL_CONNECTED)
        return;
    HTTPClient http;
    String url = String(serverBase) + "/api/airquality/device";
    http.begin(url);
    attachAuthHeaders(http);
    float pct = mq135Percent(raw);
    float ppm = mq135PseudoPPM(raw);
    float pm25 = pct * 0.8f;   // rough scaling
    float co2 = ppm;           // pseudo ppm
    float temperature = 25.0f; // placeholder
    float humidity = 50.0f;    // placeholder
    String payload = String("{\"pm25\":") + pm25 + ",\"co2\":" + co2 + ",\"temperature\":" + temperature + ",\"humidity\":" + humidity + "}";
    int code = http.POST(payload);
    Serial.printf("AirQuality POST code=%d\n", code);
    http.end();
}

// -------------------- POST Device Status/Heartbeat --------------------
void postDeviceStatus()
{
    if (WiFi.status() != WL_CONNECTED)
        return;
    HTTPClient http;
    String url = String(serverBase) + "/api/devices/status";
    http.begin(url);
    attachAuthHeaders(http);
    int rssi = WiFi.RSSI();
    int battery = 95;
    String payload = String("{\"deviceId\":\"") + deviceId + "\",\"signal\":" + rssi + ",\"battery\":" + battery + ",\"status\":\"online\"}";
    int code = http.POST(payload);
    String response = http.getString();
    Serial.printf("Device status POST code=%d\n", code);
    if (response.length())
    {
        Serial.println("Device status response:");
        Serial.println(response);
    }
    http.end();
    if (code >= 200 && code < 300 && response.length())
    {
        updateDeviceProfileFromJson(response);
    }
}

void attachAuthHeaders(HTTPClient &http)
{
    http.addHeader("Content-Type", "application/json");
    if (deviceId.length())
        http.addHeader("X-Device-ID", deviceId);
}

String extractJsonValue(const String &json, const String &key)
{
    int idx = json.indexOf(key);
    if (idx < 0)
        return "";
    int start = idx + key.length();
    int end = json.indexOf('"', start);
    if (end < 0)
        return "";
    return json.substring(start, end);
}

String extractNestedJsonValue(const String &json, const String &sectionKey, const String &fieldKey)
{
    int sectionIdx = json.indexOf(sectionKey);
    if (sectionIdx < 0)
        return "";
    int idx = json.indexOf(fieldKey, sectionIdx);
    if (idx < 0)
        return "";
    int start = idx + fieldKey.length();
    int end = json.indexOf('"', start);
    if (end < 0)
        return "";
    return json.substring(start, end);
}

String formatClassLabel(const String &room, const String &grade, const String &section)
{
    String label = room;
    String gradePart = grade;
    if (section.length())
    {
        if (gradePart.length())
            gradePart += "-";
        gradePart += section;
    }
    if (label.length() && gradePart.length())
    {
        label += " - ";
        label += gradePart;
    }
    else if (!label.length())
    {
        label = gradePart;
    }
    if (!label.length())
        label = "Unassigned";
    return label;
}

void updateDeviceProfileFromJson(const String &json)
{
    String name = extractJsonValue(json, "\"name\":\"");
    if (name.length())
        deviceProfile.name = name;

    String location = extractJsonValue(json, "\"location\":\"");
    if (location.length())
        deviceProfile.location = location;

    String status = extractJsonValue(json, "\"status\":\"");
    if (status.length())
        deviceProfile.status = status;

    String room = extractNestedJsonValue(json, "\"classroom\":{", "\"name\":\"");
    String grade = extractNestedJsonValue(json, "\"classroom\":{", "\"grade\":\"");
    String section = extractNestedJsonValue(json, "\"classroom\":{", "\"section\":\"");
    String label = formatClassLabel(room, grade, section);
    if (label.length())
        deviceProfile.classLabel = label;

    idleScreenDrawn = false;
    if (!currentEnrollment.active)
    {
        showIdleScreen();
    }
}

void showAttendanceConfirmation(const String &name, const String &studentCode, uint16_t fingerprintId, int confidence)
{
    idleScreenDrawn = false;
    oledHeader("Attendance OK");
    display.setCursor(0, 16);
    if (name.length())
        display.println(name);
    else
        display.println("Student recorded");
    display.setCursor(0, 28);
    display.print("ID: ");
    if (studentCode.length())
        display.println(studentCode);
    else
        display.println(fingerprintId);
    display.setCursor(0, 40);
    display.print("Slot ");
    display.print(fingerprintId);
    display.print(" Conf ");
    display.println(confidence);
    oledFooter("Synced with server");
    display.display();
}

bool parseTemplateAllowList(const String &json, bool allowed[], size_t maxSlots)
{
    bool any = false;
    for (size_t i = 0; i < maxSlots; ++i)
        allowed[i] = false;

    const int len = json.length();
    int idx = 0;
    while (idx < len)
    {
        while (idx < len && !isDigit(json[idx]))
            idx++;
        int start = idx;
        while (idx < len && isDigit(json[idx]))
            idx++;
        if (start < idx)
        {
            int value = json.substring(start, idx).toInt();
            if (value > 0 && value < static_cast<int>(maxSlots))
            {
                allowed[value] = true;
                any = true;
            }
        }
    }
    return any;
}

void syncTemplatesWithServer()
{
    if (WiFi.status() != WL_CONNECTED)
        return;
    HTTPClient http;
    String url = String(serverBase) + "/api/fingerprint/device/templates";
    http.begin(url);
    attachAuthHeaders(http);
    int code = http.POST("{}");
    Serial.printf("Template sync status=%d\n", code);
    if (code != 200)
    {
        http.end();
        return;
    }
    String body = http.getString();
    http.end();
    bool allowed[201];
    if (!body.length() || !parseTemplateAllowList(body, allowed, 201))
        return;

    for (uint16_t slot = 1; slot < 200; ++slot)
    {
        if (allowed[slot])
            continue;
        if (finger.loadModel(slot) == FINGERPRINT_OK)
        {
            if (finger.deleteModel(slot) == FINGERPRINT_OK)
            {
                Serial.printf("Removed stale fingerprint slot %u\n", slot);
            }
        }
    }
}

bool fetchNextEnrollmentJob(EnrollmentJob &job)
{
    if (WiFi.status() != WL_CONNECTED)
        return false;
    HTTPClient http;
    String url = String(serverBase) + "/api/fingerprint/device/next";
    http.begin(url);
    attachAuthHeaders(http);
    int code = http.POST("{}");
    Serial.printf("Enrollment poll status=%d\n", code);
    if (code != 200)
    {
        http.end();
        return false;
    }
    String body = http.getString();
    http.end();
    body.trim();
    if (body == "null" || body.length() < 5)
        return false;

    job.id = extractJsonValue(body, "\"id\":\"");
    job.studentName = extractNestedJsonValue(body, "\"student\":{", "\"name\":\"");
    if (!job.studentName.length())
        job.studentName = "Student";
    job.studentCode = extractNestedJsonValue(body, "\"student\":{", "\"studentId\":\"");
    String room = extractNestedJsonValue(body, "\"classroom\":{", "\"name\":\"");
    String grade = extractNestedJsonValue(body, "\"classroom\":{", "\"grade\":\"");
    String section = extractNestedJsonValue(body, "\"classroom\":{", "\"section\":\"");
    job.classLabel = formatClassLabel(room, grade, section);
    job.active = job.id.length() > 0;
    return job.active;
}

void showEnrollmentPrompt(const EnrollmentJob &job)
{
    idleScreenDrawn = false;
    oledHeader("Enroll Student");
    display.setCursor(0, 16);
    display.print(job.studentName);
    display.setCursor(0, 28);
    if (job.studentCode.length())
    {
        display.print("ID: ");
        display.println(job.studentCode);
    }
    else
    {
        display.println("Ready for capture");
    }
    display.setCursor(0, 40);
    if (job.classLabel.length())
        display.println(job.classLabel);
    else
        display.println("Assigned via web app");
    oledFooter("Press ENROLL when ready");
    display.display();
}

bool sendEnrollmentComplete(const EnrollmentJob &job, uint16_t slotId)
{
    if (!job.active)
        return false;
    HTTPClient http;
    String url = String(serverBase) + "/api/fingerprint/device/" + job.id + "/complete";
    http.begin(url);
    attachAuthHeaders(http);
    String payload = String("{\"fingerprintId\":") + slotId + "}";
    int code = http.POST(payload);
    Serial.printf("Enrollment complete code=%d\n", code);
    http.end();
    return code >= 200 && code < 300;
}

void reportEnrollmentFailure(const EnrollmentJob &job, const String &reason)
{
    if (!job.active)
        return;
    HTTPClient http;
    String url = String(serverBase) + "/api/fingerprint/device/" + job.id + "/fail";
    http.begin(url);
    attachAuthHeaders(http);
    String safeReason = reason;
    if (!safeReason.length())
        safeReason = "Device error";
    safeReason.replace("\"", "'");
    String payload = String("{\"reason\":\"") + safeReason + "\"}";
    int code = http.POST(payload);
    Serial.printf("Enrollment fail code=%d\n", code);
    http.end();
}

void clearEnrollmentJob()
{
    currentEnrollment.active = false;
    currentEnrollment.id = "";
    currentEnrollment.studentName = "";
    currentEnrollment.studentCode = "";
    currentEnrollment.classLabel = "";
    lastEnrollmentPollMs = 0;
    showIdleScreen();
}

void pollEnrollmentQueue()
{
    unsigned long now = millis();
    if (currentEnrollment.active)
        return;
    if (now - lastEnrollmentPollMs < ENROLLMENT_POLL_MS)
        return;
    lastEnrollmentPollMs = now;
    EnrollmentJob job{false, "", "", "", ""};
    if (fetchNextEnrollmentJob(job))
    {
        currentEnrollment = job;
        currentEnrollment.active = true;
        showEnrollmentPrompt(currentEnrollment);
    }
}

void showIdleScreen()
{
    idleScreenDrawn = true;
    oledHeader("Scanner Ready");
    display.setCursor(0, 16);
    display.print("Name: ");
    display.println(deviceProfile.name.length() ? deviceProfile.name : deviceId);
    display.setCursor(0, 28);
    display.print("Location: ");
    display.println(deviceProfile.location.length() ? deviceProfile.location : "--");
    display.setCursor(0, 40);
    if (deviceProfile.classLabel.length())
        display.println(deviceProfile.classLabel);
    else
        display.println("No class linked");
    oledFooter("Waiting for capture");
    display.display();
}


// -------------------- Setup --------------------
void setup()
{
    Serial.begin(115200);
    delay(200);
    Serial.println("ESP32 + R307 + MQ135 + SH1106");

    analogReadResolution(12);
    Wire.begin();
    if (!display.begin(OLED_I2C_ADDR, true))
        Serial.println("SH1106 init failed!");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(0, 0);
    display.println("Initializing...");
    display.display();

    FingerSerial.begin(57600, SERIAL_8N1, 16, 17);
    finger.begin(57600);
    delay(200);
    if (finger.verifyPassword())
        Serial.println("Fingerprint sensor found!");
    else
        Serial.println("Fingerprint sensor NOT found");

    setupWiFi();

    pinMode(ENROLL_BUTTON_PIN, INPUT_PULLUP);

    // Attach interrupts on falling edge (button to GND)
    attachInterrupt(digitalPinToInterrupt(ENROLL_BUTTON_PIN), isrEnroll, FALLING);

    for (uint16_t testId = 1; testId < 200; ++testId)
    {
        if (finger.loadModel(testId) != FINGERPRINT_OK)
        {
            nextEnrollId = testId;
            break;
        }
    }

    postDeviceStatus();
    showIdleScreen();
}

// -------------------- Loop --------------------
void loop()
{
    // Handle interrupt-driven buttons with debounce in main loop
    unsigned long now = millis();
    pollEnrollmentQueue();

    // Enrollment button
    if (enrollIRQ && (now - lastBtnMs) > BTN_DEBOUNCE_MS && !enrollRequested)
    {
        lastBtnMs = now;
        enrollIRQ = false;
        enrollRequested = true;
        Serial.println("Enroll button pressed");
        bool jobTriggered = currentEnrollment.active;
        const char *titleOverride = jobTriggered ? currentEnrollment.studentName.c_str() : nullptr;
        bool success = enrollFingerprint(nextEnrollId, titleOverride);
        if (success)
        {
            if (jobTriggered)
            {
                bool synced = sendEnrollmentComplete(currentEnrollment, nextEnrollId);
                if (!synced)
                {
                    reportEnrollmentFailure(currentEnrollment, "Upload failed");
                }
                clearEnrollmentJob();
            }
            nextEnrollId++;
        }
        else if (jobTriggered)
        {
            String reason = lastEnrollError.length() ? lastEnrollError : "Enrollment failed";
            reportEnrollmentFailure(currentEnrollment, reason);
            clearEnrollmentJob();
        }
        enrollRequested = false;
    }

    // Handle cancel request during enrollment
    if (cancelEnrollIRQ && enrollInProgress)
    {
        lastBtnMs = now;
    }

    if (now - lastAQMs >= AQ_INTERVAL_MS)
    {
        lastAQMs = now;
        int raw = readMQ135Raw();
        Serial.printf("MQ135 raw=%d\n", raw);
        postAirQuality(raw);
        // Send a heartbeat periodically so UI shows the device
        postDeviceStatus();
    }

    // Fingerprint scan
    int id = getFingerprintID();
    if (id >= 0)
    {
        Serial.printf("Fingerprint ID=%d conf=%d\n", id, fingerConfidence);
        showFingerprintStatus("MATCH", id, fingerConfidence);
        postAttendance(id, fingerConfidence);
        delay(1500);
    }
    else
    {
        if (!currentEnrollment.active && !idleScreenDrawn)
        {
            showIdleScreen();
        }
        delay(100);
    }
}
