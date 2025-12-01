/*Include Sections*/
#include "DHT.h"
#include <WiFi.h>
#include "esp_wpa2.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

//////////////////////////////////////////////////////////////////
/*LED Pin Definitions*/
#define LED_ALIVE 2      // System heartbeat (built-in LED)
#define LED_WIFI 23      // WiFi status
#define LED_BACKEND 22   // Backend communication

//////////////////////////////////////////////////////////////////
/*Variable Declaration*/

const char* ssid = "Iot";
const char* password = "serpiente";

#define LO_PLUS 18
#define LO_LOW 19
#define ECG_PIN 33
#define EDA_PIN 32

/*Ultimos valores leidos*/
float lastTempValue = 0;
uint16_t lastEDAValue = 0;
uint16_t lastECGValue = 0;

/* ----- TIMERS ----- */
uint32_t lastECG = 0;
uint32_t lastEDA = 0;
uint32_t lastTemp = 0;
uint32_t lastHeartbeat = 0;

const uint16_t ECG_INTERVAL  = 4;     // 250 Hz
const uint16_t EDA_INTERVAL  = 100;   // 10 Hz
const uint16_t TEMP_INTERVAL = 5000;  // 0.2 Hz (every 5 seconds) - MODIFIED!

uint32_t lastSend = 0;
const uint32_t SEND_INTERVAL = 3000; // enviar cada 3 segundos

/*Structure Declaration*/
struct SensorRecord{
  uint32_t ts;
  float ecg;
  float eda;
  float temp;

  SensorRecord(){}

  SensorRecord(uint32_t ts_, float ecg_, float eda_, 
  float temp_): ts(ts_), ecg(ecg_), 
  eda(eda_), temp(temp_){};
};

#define BUFFER_MAX 200
SensorRecord buffer[BUFFER_MAX];
int bufferIndex = 0;

//////////////////////////////////////////////////////////////////
/*Function Declaration*/

void initWiFi(const char* ssid, const char* password){
  Serial.println("Conectando a WiFi");
  
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_WIFI, LOW);
    Serial.print(".");
    delay(400);
  }
  
  Serial.println("\nConectado a WiFi");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  digitalWrite(LED_WIFI, HIGH);
  }

void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado! Intentando reconectar...");
    digitalWrite(LED_WIFI, LOW);
    WiFi.disconnect();
    WiFi.reconnect();

    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 5000) {
      Serial.print(".");
      delay(500);
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nReconectado a WiFi!");
      digitalWrite(LED_WIFI, HIGH);
    } else {
      Serial.println("\nNo se pudo reconectar.");
      
    }
  }
}

void sendBufferToBackend(
    const char* backendURL,
    const char* deviceId
) {
    digitalWrite(LED_BACKEND, LOW);
    
    //Prueba para verificar que el backend es alcanzable
  
    HTTPClient http;
    http.setTimeout(2000);  // 2 second timeout
    
    if (!http.begin(backendURL)) {
        Serial.println("Failed to initialize HTTP connection");
        return;
    }

    http.addHeader("Content-Type", "application/json");

    DynamicJsonDocument doc(8192); 
    doc["deviceId"] = deviceId;

    JsonArray readings = doc.createNestedArray("readings");

    // Copiar todo el buffer
    for (int i = 0; i < bufferIndex; i++) {
        JsonObject item = readings.createNestedObject();
        item["ts"]   = buffer[i].ts;
        item["ecg"]  = buffer[i].ecg;
        item["eda"]  = buffer[i].eda;
        item["temp"] = buffer[i].temp;
    }

    String payload;
    serializeJson(doc, payload);

    Serial.println("Enviando buffer...");
    Serial.print("Readings en buffer: ");
    Serial.println(bufferIndex);

    int code = http.POST(payload);

    Serial.print("HTTP Response: ");
    Serial.println(code);


    if (code == 200) {
        Serial.println("Buffer enviado correctamente.");
        digitalWrite(LED_BACKEND, HIGH);
        bufferIndex = 0;
    } else {
        Serial.println("Error enviando buffer, se conservarán datos.");
    }

    http.end();
    bufferIndex = 0;
}

DHT dht(21, DHT11);

//////////////////////////////////////////////////////////////////
//SetUp
void setup() {
  Serial.begin(115200);
  
  // Initialize LEDs first
  pinMode(LED_ALIVE, OUTPUT);
  pinMode(LED_WIFI, OUTPUT);
  pinMode(LED_BACKEND, OUTPUT);
  
  // All LEDs off at start
  digitalWrite(LED_ALIVE, LOW);
  digitalWrite(LED_WIFI, LOW);
  digitalWrite(LED_BACKEND, LOW);
  
  dht.begin();

  // Initialize WiFi
  initWiFi(ssid, password);

  // PIN Declaration
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_LOW, INPUT);
  pinMode(ECG_PIN, INPUT);
  pinMode(EDA_PIN, INPUT);

  delay(500);

  // Lectura simultanea de los sensores
  lastECGValue = analogRead(ECG_PIN);
  lastEDAValue = analogRead(EDA_PIN);
  float t = dht.readTemperature();
  lastTempValue = isnan(t) ? 0 : t;

  // Impresion de los valores obtenidos
  Serial.println("Lectura inicial OK:");
  Serial.print("Temp: "); Serial.println(lastTempValue);
  Serial.print("ECG:  "); Serial.println(lastECGValue);
  Serial.print("EDA:  "); Serial.println(lastEDAValue);
  
  
  Serial.println("\n=== IMPORTANTE ===");
  Serial.println("Temperatura se lee cada 5 segundos para evitar bloqueos");
  Serial.println("ECG: 250 Hz | EDA: 10 Hz | TEMP: 0.2 Hz");
  Serial.println("==================\n");
}

//////////////////////////////////////////////////////////////////
void loop() {
  checkWiFi();

  Serial.println(bufferIndex);
  delay(25);
  uint32_t now = millis();

  bool updatedECG = false;
  bool updatedEDA = false;
  bool updatedTemp = false;

  /* ---------- ECG (250 Hz) ---------- */
  if (now - lastECG >= ECG_INTERVAL) {
    lastECG = now;

    if ((digitalRead(LO_PLUS) == 0) && (digitalRead(LO_LOW) == 0)) {
      lastECGValue = analogRead(ECG_PIN);
    } else {
      // ECG sensor not properly connected
    }

    updatedECG = true;
  }

  /* ---------- EDA (10 Hz) ---------- */
  if (now - lastEDA >= EDA_INTERVAL) {
    lastEDA = now;
    lastEDAValue = analogRead(EDA_PIN);
    updatedEDA = true;
  }

  /* ---------- TEMP (0.2 Hz - every 5 seconds) ---------- */
  if (now - lastTemp >= TEMP_INTERVAL) {
    lastTemp = now;

    Serial.println("Leyendo temperatura...");
    float t = dht.readTemperature();
    
    if (!isnan(t)) {
      lastTempValue = t;
      Serial.print("Temperatura actualizada: ");
      Serial.println(lastTempValue);
    } else {
      Serial.println("Error leyendo temperatura");
    }

    updatedTemp = true;
  }

  /* Si uno de los 3 sensores se ha actualizado, se guarda el registro */
  if (updatedECG || updatedEDA || updatedTemp) {
    if (bufferIndex < BUFFER_MAX){  
      SensorRecord r;
      r.ts   = now;
      r.ecg  = lastECGValue;
      r.eda  = lastEDAValue;
      r.temp = lastTempValue;

      buffer[bufferIndex++] = r;

      // Solo imprimir cada 50 lecturas para no saturar Serial
      if (bufferIndex % 5 == 0) {
        Serial.print("Buffer: "); 
        Serial.print(bufferIndex);
        Serial.print("/");
        Serial.print(BUFFER_MAX);
        Serial.print(" | Temp: ");
        Serial.print(lastTempValue);
        Serial.print(" | ECG: ");
        Serial.print(lastECGValue);
        Serial.print(" | EDA: ");
        Serial.println(lastEDAValue);
      }
    } else {
      // Buffer full - error condition
      Serial.println("ALERTA: Buffer lleno!");
    }
  }
  
  // Send buffer when fullgnh
  if (bufferIndex >= BUFFER_MAX) {
    Serial.println("Buffer lleno, enviando...");
    sendBufferToBackend("http://10.146.61.238:8000/sensor-data", "prototype01");
  }

}