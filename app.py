from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit
import speech_recognition as sr
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'  # Secret key is required for SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

recognizer = sr.Recognizer()
is_recording = False
measurements = []  # Define measurements as a global variable
measurement_index = 0
measurement_commands = ["next", "previous", "stop", "repeat", "exit"]

# Adjust recognizer settings to improve microphone listening efficiency
recognizer.energy_threshold = 250  # Lowered threshold to increase sensitivity
recognizer.pause_threshold = 0.5   # Reduce pauses required to consider listening complete

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start', methods=['POST'])
def start_recording():
    global is_recording
    if not is_recording:
        is_recording = True
        threading.Timer(0.1, start_recording_task).start()  # Slight delay to ensure request cycle completion
        return jsonify({"message": "Recording started"})
    else:
        return jsonify({"message": "Already recording"}), 400

@app.route('/stop', methods=['POST'])
def stop_recording():
    global is_recording
    is_recording = False
    return jsonify({"message": "Recording stopped", "measurements": measurements})

def start_recording_task():
    socketio.start_background_task(target=listen_for_measurements)

def listen_for_measurements():
    global is_recording, measurements, measurement_index
    measurements = []  # Clear measurements when starting a new recording
    measurement_index = 0

    with sr.Microphone() as source:
        while is_recording:
            try:
                print("Listening for measurement...")
                audio = recognizer.listen(source)

                # Recognize the command and convert to lowercase
                command = recognizer.recognize_google(audio).lower()

                # Check if the command is a number (either integer or float)
                try:
                    measurement = float(command) if '.' in command else int(command)
                    measurements.append(measurement)  # Store the measurement
                    emit_measurement(measurement, measurement_index)
                    measurement_index += 1
                except ValueError:
                    # If command is not a number, check if it is in measurement commands
                    if command in measurement_commands:
                        print(f"Control command: {command}")
                        handle_command(command)
            except sr.UnknownValueError:
                print("Could not understand the audio")
            except sr.RequestError as e:
                print(f"Could not request results; {e}")

def emit_measurement(measurement, index):
    # Emit the measurement data to the client
    socketio.emit('measurement', {"measurement": measurement, "index": index})

def handle_command(command):
    global is_recording
    if command == "stop":
        is_recording = False
    elif command in ["next", "previous"]:
        # Emit specific navigation commands to the client
        socketio.emit(command)

@socketio.on('connect')
def handle_connect():
    print("Client connected")

@socketio.on('disconnect')
def handle_disconnect():
    global is_recording
    is_recording = False
    print("Client disconnected")

if __name__ == '__main__':
    # For development, consider using a more robust WSGI server in production
    socketio.run(app, debug=True, host='0.0.0.0')
