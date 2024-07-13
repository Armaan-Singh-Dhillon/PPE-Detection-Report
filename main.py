from flask import Flask
from flask_socketio import SocketIO, emit
import cv2
import math
import pygame
from ultralytics import YOLO
import numpy as np
import eventlet
import time
from sort import Sort
from nanoid import generate

eventlet.monkey_patch()

# Initialize Pygame mixer
pygame.mixer.init()
# Load beep sound
beep_sound = pygame.mixer.Sound("alarm.mp3")

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

cap = cv2.VideoCapture(0)  # For Webcam
cap.set(3, 1280)
cap.set(4, 720)
# cap = cv2.VideoCapture("ppe-2-1.mp4")  # For Video

model = YOLO("best.pt")

classNames = ['Hardhat', 'Mask', 'NO-Hardhat', 'NO-Mask', 'NO-Safety Vest',
              'Person', 'Safety Cone', 'Safety Vest', 'machinery', 'vehicle']

alarm_playing = False  # Track if the alarm is playing
tracker = Sort(max_age=20, min_hits=3, iou_threshold=0.3)

emitted_ids = set()  # Track emitted IDs


def put_text(img, text, org, scale=1, thickness=2, color=(0, 255, 0), bgcolor=(0, 0, 0)):
    font = cv2.FONT_HERSHEY_SIMPLEX
    text_size = cv2.getTextSize(text, font, scale, thickness)[0]
    text_w, text_h = text_size
    cv2.rectangle(img, (org[0], org[1] - text_h - 10),
                  (org[0] + text_w, org[1]), bgcolor, -1)
    cv2.putText(img, text, org, font, scale, color, thickness, cv2.LINE_AA)


def generate_object_data():
    global alarm_playing

    while True:
        success, img = cap.read()
        if not success:
            # If the video ends, reset to the beginning
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        results = model(img, stream=True)
        detections = np.empty((0, 5))
        # Flag to check if any safety violation is detected
        safety_violation_detected = False

        for r in results:
            boxes = r.boxes
            for box in boxes:
                # Bounding Box
                x1, y1, x2, y2 = box.xyxy[0]
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                w, h = x2 - x1, y2 - y1

                # Confidence
                conf = math.ceil((box.conf[0] * 100)) / 100
                # Class Name
                cls = int(box.cls[0])
                currentClass = classNames[cls]

                if conf > 0.5 and currentClass == 'NO-Hardhat':
                    safety_violation_detected = True  # Set flag if a safety violation is detected
                    put_text(img, f'{currentClass} {conf}', (max(0, x1), max(
                        35, y1)), scale=1, thickness=1, color=(0, 255, 0))
                    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 3)
                    currentArray = np.array([x1, y1, x2, y2, conf])
                    detections = np.vstack([detections, currentArray])

        resultsTracker = tracker.update(detections)

        for result in resultsTracker:
            x1, y1, x2, y2, id_ = result
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 0), 2)
            put_text(img, f'ID: {int(id_)}', (x1, y1 - 10), scale=1,
                     thickness=2, color=(255, 0, 0), bgcolor=(0, 0, 0))

            if safety_violation_detected and int(id_) not in emitted_ids:
                emitted_ids.add(int(id_))
                unique_id = generate()

                data = {
                    'id': unique_id,
                    'status': "No Hardhat Detected",
                    'position': {'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2},
                    'confidence': float(conf),
                    'timestamp': int(time.time() * 1000)
                }
                socketio.emit('object_data', data)
                print(data)

        if safety_violation_detected:
            # Alert message if any safety violation is detected
            put_text(img, 'Safety Violation Detected', (50, 50),
                     scale=2, thickness=2, color=(0, 0, 255))
            # Play beep sound in loop if it hasn't been started yet
            if not alarm_playing:
                beep_sound.play(loops=-1)
                alarm_playing = True
        else:
            # Stop the alarm if no safety violation is detected
            if alarm_playing:
                beep_sound.stop()
                alarm_playing = False

        # Display the image
        cv2.imshow("Image", img)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        eventlet.sleep(0)


@app.route('/')
def index():
    return "Object Detection Server Running"


@socketio.on('connect')
def handle_connect():
    print('Client connected')
    socketio.start_background_task(generate_object_data)


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


if __name__ == '__main__':
    print("Starting server...")
    socketio.run(app, host='0.0.0.0', port=5002)

cap.release()
cv2.destroyAllWindows()
pygame.quit()
