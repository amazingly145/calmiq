from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
from scipy.signal import find_peaks
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from collections import deque

app = FastAPI()


class Config:
    ECG_SAMPLE_RATE_HZ = 250
    POSTS_BEFORE_FIREBASE = 1
    FIREBASE_CRED_PATH = "fbkey.json"


config = Config()

# Firebase Initialization
cred = credentials.Certificate(config.FIREBASE_CRED_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()


class SensorReading(BaseModel):
    """Single sensor reading with timestamp"""
    ts: int  # timestamp in milliseconds
    ecg: float  # ECG value
    eda: float  # EDA value
    temp: float  # Temperature value


class DeviceData(BaseModel):
    """Data sent from ESP32"""
    deviceId: str
    readings: List[SensorReading]


class MonitorState:
    def __init__(self):
        self.post_count = 0
        self.ecg_history = deque(maxlen=config.POSTS_BEFORE_FIREBASE)
        self.timestamp_history = deque(maxlen=config.POSTS_BEFORE_FIREBASE)
        self.eda_history = deque(maxlen=config.POSTS_BEFORE_FIREBASE)
        self.temp_history = deque(maxlen=config.POSTS_BEFORE_FIREBASE)
        self.bpm_history = deque(maxlen=config.POSTS_BEFORE_FIREBASE)
        self.last_bpm = None
        self.last_dbpm = None
        self.last_eda_avg = None
        self.last_temp_avg = None


state = MonitorState()


def calculate_actual_sample_rate(timestamps: List[int]) -> float:
    """
    Calculate the actual sampling rate from timestamps.
    Returns the actual Hz rate, or default 250 Hz if calculation fails.
    """
    if len(timestamps) < 2:
        return config.ECG_SAMPLE_RATE_HZ

    # Calculate time differences between consecutive samples (in milliseconds)
    time_diffs = np.diff(timestamps)

    # Filter out any invalid differences (zero or negative)
    valid_diffs = time_diffs[time_diffs > 0]

    if len(valid_diffs) < 2:
        return config.ECG_SAMPLE_RATE_HZ

    # Use median to avoid outlier impact (more robust than mean)
    median_interval_ms = np.median(valid_diffs)

    # Convert to Hz: 1000 ms/second ÷ interval in ms = samples per second
    actual_rate = 1000.0 / median_interval_ms

    return round(actual_rate, 2)


def calculate_bpm(ecg_values: List[float], sample_rate: float) -> float:
    """
    Calculate BPM from ECG values using peak detection.
    Uses the provided sample_rate for accurate calculation.
    """
    if len(ecg_values) < 2:
        return 0.0

    ecg_array = np.array(ecg_values)

    # Calculate minimum distance between peaks based on actual sample rate
    # Assume maximum heart rate of 180 BPM = 3 beats/second
    # Minimum time between beats = 1/3 second
    min_peak_distance = int(sample_rate / 3)

    # Find peaks (R-peaks in ECG)
    try:
        peaks, _ = find_peaks(
            ecg_array,
            distance=min_peak_distance,
            prominence=np.std(ecg_array) * 0.5
        )
    except Exception:
        return 0.0

    if len(peaks) < 2:
        return 0.0

    # Calculate time between peaks using actual sample rate
    peak_intervals = np.diff(peaks) / sample_rate  # in seconds
    avg_interval = np.mean(peak_intervals)

    # Convert to BPM
    bpm = 60.0 / avg_interval if avg_interval > 0 else 0.0

    return round(bpm, 2)


def calculate_bpm_derivative(bpm_values: List[float]) -> float:
    """
    Calculate the change in BPM over time using linear regression.
    Returns BPM/minute change rate.
    """
    if len(bpm_values) < 2:
        return 0.0

    x = np.arange(len(bpm_values))
    y = np.array(bpm_values)

    # Linear regression to find trend
    slope = np.polyfit(x, y, 1)[0]

    return round(slope, 2)


def send_to_firebase(device_id: str, bpm: float, dbpm: float, eda_avg: float, temp_avg: float, timestamp: float):
    """
    Send aggregated data to Firebase using hierarchical structure:
    /devices/{deviceId}/days/{YYYY-MM-DD}/readings/{ts_ms}
    """

    # Convert Unix timestamp (seconds) to datetime object
    dt = datetime.fromtimestamp(timestamp)

    # Format the date as YYYY-MM-DD for the day key
    day_key = dt.strftime("%Y-%m-%d")

    # Convert timestamp to milliseconds for the reading key
    ts_ms = int(timestamp * 1000)

    # Prepare the data to store
    reading_data = {
        "bpm": bpm,
        "bpm_prima": dbpm,  # bpm derivative (rate of change)
        "eda_ave": eda_avg,
        "temp_ave": temp_avg,
        "created_at": firestore.firestore.SERVER_TIMESTAMP
    }

    try:
        # Build the hierarchical path
        # /devices/{deviceId}/days/{YYYY-MM-DD}/readings/{ts_ms}
        doc_ref = db.collection('devices') \
            .document(device_id) \
            .collection('days') \
            .document(day_key) \
            .collection('readings') \
            .document(str(ts_ms))

        # Set the data at this location
        doc_ref.set(reading_data)

        print(f"Data sent to Firebase:")
        print(f"  Path: devices/{device_id}/days/{day_key}/readings/{ts_ms}")
        print(f"  Data: {reading_data}")

    except Exception as e:
        print(f"Firebase error: {e}")
        raise HTTPException(status_code=500, detail=f"Firebase write failed: {str(e)}")


@app.post("/sensor-data")
async def receive_sensor_data(data: DeviceData):
    """
    Receives data from ESP32 with automatic timing correction.
    """

    if not data.readings or len(data.readings) == 0:
        raise HTTPException(status_code=400, detail="No readings provided")

    print(f"Received data from device: {data.deviceId}")
    print(f"Number of readings: {len(data.readings)}")

    # Extract values from all readings
    ecg_values = [reading.ecg for reading in data.readings]
    eda_values = [reading.eda for reading in data.readings]
    timestamps = [reading.ts for reading in data.readings]
    temp_values = [reading.temp for reading in data.readings]

    # Calculate actual sample rate from timestamps
    actual_sample_rate = calculate_actual_sample_rate(timestamps)
    print(f"Detected sample rate: {actual_sample_rate} Hz (expected: {config.ECG_SAMPLE_RATE_HZ} Hz)")

    # Calculate BPM using the actual sample rate (automatically corrects for timing issues)
    current_bpm = calculate_bpm(ecg_values, actual_sample_rate)

    # Use the last timestamp as reference (convert milliseconds to seconds)
    last_timestamp = timestamps[-1] / 1000.0

    # Store data
    state.ecg_history.append(ecg_values)
    state.timestamp_history.append(last_timestamp)
    state.eda_history.append(np.mean(eda_values))
    state.temp_history.append(np.mean(temp_values))
    state.bpm_history.append(current_bpm)
    state.post_count += 1

    print(f"Current BPM: {current_bpm}")
    print(f"Post count: {state.post_count}/{config.POSTS_BEFORE_FIREBASE}")

    response = {
        "device_id": data.deviceId,
        "readings_received": len(data.readings),
        "current_bpm": current_bpm,
        "post_count": state.post_count,
        "status": "collecting"
    }

    # After 6 posts, calculate derivatives and send to Firebase
    if state.post_count >= config.POSTS_BEFORE_FIREBASE:
        bpm_derivative = calculate_bpm_derivative(list(state.bpm_history))
        eda_average = round(np.mean(list(state.eda_history)), 2)
        temp_average = round(np.mean(list(state.temp_history)), 2)

        # Send to Firebase with device_id
        send_to_firebase(data.deviceId, current_bpm, bpm_derivative, eda_average, temp_average, last_timestamp)

        # Store for future calculations
        state.last_bpm = current_bpm
        state.last_dbpm = bpm_derivative
        state.last_eda_avg = eda_average
        state.last_temp_avg = temp_average

        # Reset counter
        state.post_count = 0

        response.update({
            "bpm_derivative": bpm_derivative,
            "eda_average": eda_average,
            "temp_average": temp_average,
            "status": "sent_to_firebase"
        })

        print(
            f"Data sent to Firebase - Device: {data.deviceId}, BPM: {current_bpm}, Derivative: {bpm_derivative}, Temp: {temp_average}")

    return response


@app.get("/stats")
async def get_stats():
    """Get current statistics"""
    return {
        "post_count": state.post_count,
        "last_bpm": state.last_bpm,
        "last_dbpm": state.last_dbpm,
        "last_eda_avg": state.last_eda_avg,
        "last_temp_avg": state.last_temp_avg,
        "posts_until_firebase": max(0, config.POSTS_BEFORE_FIREBASE - state.post_count)
    }


@app.post("/reset")
async def reset_state():
    """Reset monitoring state"""
    global state
    state = MonitorState()
    return {"status": "reset_complete"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)