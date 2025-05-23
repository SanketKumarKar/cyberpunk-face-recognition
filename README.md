# Face Recognition Web

A browser-based face recognition application that works entirely client-side using JavaScript. This project detects faces, facial landmarks, and expressions in real-time from your webcam.

## 🌟 Features

- **Real-time face detection** directly in the browser
- **Facial landmark detection** to identify key face points
- **Expression recognition** to detect emotions
- **Snapshot capture** to save detection results
- **Responsive design** that works across devices
- **No server required** - all processing happens on the client

## 🚀 Live Demo

Visit the live demo at: [https://cyberface-scan.netlify.app/](!!!ClickMe!!!)

## 🔧 How It Works

This project uses [face-api.js](https://github.com/justadudewhohacks/face-api.js), a JavaScript library built on top of TensorFlow.js, to provide face detection and recognition capabilities directly in the browser. The application:

1. Loads pre-trained models for face detection, facial landmarks, and expression recognition
2. Accesses your webcam (with permission)
3. Processes video frames in real-time to detect faces
4. Draws bounding boxes, landmarks, or expression results on an overlay canvas

All processing happens in the browser – no data is sent to any server!

## 📋 Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Webcam access
- JavaScript enabled

## 🔍 Usage Instructions

1. **Start Camera**: Click the "Start Camera" button to enable your webcam
2. **Detection Type**: Choose from:
   - Face Detection: Detects face locations
   - Face Landmarks: Shows 68 key points on each face
   - Expression Detection: Identifies emotions like happy, sad, angry, etc.
3. **Adjust Confidence**: Set the minimum detection confidence (0.0-1.0)
4. **Take Snapshots**: Capture the current frame with detections
5. **Stop Camera**: Turn off the webcam when finished

## 🛠️ Local Development

### Prerequisites
- Git
- A web server (any simple server will do)

### Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/SanketKumarKar/cyberpunk-face-recognition.git
   cd face-recognition-web
   ```

2. Start a local web server:

   Using Python:
   ```bash
   # Python 3.x
   python -m http.server
   
   # Python 2.x
   python -m SimpleHTTPServer
   ```

   Using Node.js:
   ```bash
   # Install if needed
   npm install -g http-server
   
   # Run
   http-server
   ```

3. Open your browser and navigate to `http://localhost:8000` (or whichever port your server uses)


## 📁 Project Structure

```
face-recognition-web/
│
├── index.html         # Main HTML file
├── css/
│   └── style.css      # Styles for the application
├── js/
│   └── app.js         # JavaScript application logic
├── models/            # Face-api.js model files
└── README.md          # Project documentation
```

## ⚠️ Privacy Notice

This application processes all face data directly in your browser. No images or detection results are sent to any server. Your privacy is respected!

## 📈 Future Improvements

- [ ] Add face recognition to identify specific people
- [ ] Support for uploaded images/videos
- [ ] Save detection results to local storage
- [ ] Add more face analysis features
- [ ] Improve mobile performance

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
