// DOM Elements
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start-button');
const snapshotButton = document.getElementById('snapshot-button');
const stopButton = document.getElementById('stop-button');
const detectionType = document.getElementById('detection-type');
const minConfidence = document.getElementById('min-confidence');
const confidenceValue = document.getElementById('confidence-value');
const results = document.getElementById('results');
const snapshotsContainer = document.getElementById('snapshots-container');
const loadingScreen = document.getElementById('loading-screen');
const cameraPermissions = document.querySelector('.camera-permissions');
const retryCameraButton = document.getElementById('retry-camera');
const orientationMessage = document.querySelector('.orientation-message');

// Canvas context for drawing
const ctx = overlay.getContext('2d');

// App state
let isModelLoaded = false;
let stream = null;
let isProcessing = false;
let detectionInterval = null;
let snapshots = [];
let faceDetectionStartTime = 0;
let lastPerformanceLog = 0;
const performanceInterval = 10000; // Log performance every 10 seconds
let isMobileDevice = false;
const MINIMUM_LOADING_TIME = 2500; // Minimum loading screen time in milliseconds (2.5 seconds)
let loadingStartTime = 0;

// Check if running on a mobile device
function checkMobileDevice() {
    isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log(`Device detected: ${isMobileDevice ? 'Mobile' : 'Desktop'}`);
    
    // Set some mobile-specific adjustments
    if (isMobileDevice) {
        // Add touchend event listeners for better mobile touch response
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('touchend', (e) => {
                e.preventDefault(); // Prevent double-tap zoom on mobile
            });
        });
        
        // Listen for orientation changes
        window.addEventListener("orientationchange", handleOrientationChange);
        handleOrientationChange(); // Check initial orientation
    }
}

// Handle device orientation changes
function handleOrientationChange() {
    if (isMobileDevice && window.innerHeight < 450 && window.innerWidth > window.innerHeight) {
        // Landscape mode on small screens - suggest to rotate
        orientationMessage.style.display = 'flex';
    } else {
        orientationMessage.style.display = 'none';
    }
}

// Update confidence value display
minConfidence.addEventListener('input', () => {
    confidenceValue.textContent = minConfidence.value;
});

// Cyberpunk color scheme
const colors = {
    box: '#00ffff',
    boxHover: '#ff00ff',
    landmarks: '#4fc08d',
    text: '#ffffff',
    boxShadow: '0 0 10px rgba(0, 255, 255, 0.7)'
};

// Load the face-api.js models
async function loadModels() {
    try {
        // Record the start time of loading
        loadingStartTime = Date.now();
        showLoadingScreen('Loading Neural Networks...');
        
        // Use the CDN for models instead of local files for better performance on mobile
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
        
        // Adjust which models to load based on device type
        // For mobile, we can reduce load time by loading only essential models
        const modelsToLoad = [
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        ];
        
        // Only load expression detection on desktop or if specifically requested
        if (!isMobileDevice || localStorage.getItem('enableExpressions') === 'true') {
            modelsToLoad.push(
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            );
        } else {
            // For mobile, we'll use a lightweight landmark model
            modelsToLoad.push(
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
            );
        }
        
        await Promise.all(modelsToLoad);
        
        console.log('Models loaded successfully');
        isModelLoaded = true;
        
        // Calculate how much time has passed since loading started
        const loadingElapsedTime = Date.now() - loadingStartTime;
        
        // If models loaded faster than our minimum time, wait for the remaining time
        if (loadingElapsedTime < MINIMUM_LOADING_TIME) {
            const remainingTime = MINIMUM_LOADING_TIME - loadingElapsedTime;
            console.log(`Models loaded in ${loadingElapsedTime}ms, waiting ${remainingTime}ms more for loading effect`);
            
            // Update loading text to show progress
            const loadingText = document.querySelector('.loading-text');
            if (loadingText) loadingText.textContent = 'Neural Networks Ready...';
            
            // Wait for the remaining time before hiding loading screen
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        hideLoadingScreen();
        showSuccessNotification('Neural Networks Ready');
    } catch (error) {
        console.error('Error loading models:', error);
        showLoadingError(`Error loading neural networks: ${error.message}`);
    }
}

// Show/hide loading screen with custom message
function showLoadingScreen(message) {
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = message;
    loadingScreen.classList.remove('hidden');
}

function hideLoadingScreen() {
    loadingScreen.classList.add('hidden');
}

function showLoadingError(message) {
    const loadingContent = document.querySelector('.loading-content');
    loadingContent.innerHTML = `
        <p style="color: #ff00ff; text-align: center;">${message}</p>
        <button onclick="location.reload()" class="btn primary-btn">Reload</button>
    `;
}

// Show success notification
function showSuccessNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: #00ffff;
        padding: 15px 30px;
        border-radius: 30px;
        border: 2px solid #00ffff;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
        z-index: 1000;
        font-weight: bold;
        opacity: 0;
        transition: opacity 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;
    
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Start the webcam with mobile device handling
async function startWebcam() {
    // Hide any previous camera permission error
    if (cameraPermissions) {
        cameraPermissions.style.display = 'none';
    }
    
    try {
        showLoadingScreen('Initializing Camera...');
        
        const constraints = {
            video: {
                facingMode: 'user' // Use front camera on mobile
            }
        };
        
        // For desktop, request higher resolution
        if (!isMobileDevice) {
            constraints.video.width = { ideal: 1280 };
            constraints.video.height = { ideal: 720 };
        } else {
            // For mobile devices, use a more reasonable resolution
            // that balances performance and quality
            constraints.video.width = { ideal: 640 };
            constraints.video.height = { ideal: 480 };
        }
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set mobile video attributes at the right time
        if (isMobileDevice) {
            video.setAttribute('playsinline', '');
            video.setAttribute('autoplay', '');
            video.setAttribute('muted', '');
            video.playsInline = true;
            video.autoplay = true;
            video.muted = true;
        }
        video.srcObject = stream;
        
        // Set up video event listener to adjust canvas size once video metadata is loaded
        video.addEventListener('loadedmetadata', () => {
            // Set canvas dimensions to match the video
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            
            console.log(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
            console.log(`Canvas dimensions: ${overlay.width}x${overlay.height}`);
            
            hideLoadingScreen();
            showSuccessNotification('Camera Initialized');
        });
        
        // Make the video container have a cyber glow effect
        const videoContainer = document.querySelector('.video-container');
        videoContainer.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.5)';
        
        // Enable/disable buttons
        startButton.disabled = true;
        stopButton.disabled = false;
        snapshotButton.disabled = false;
        
        // Start detection
        startDetection();
        
    } catch (error) {
        console.error('Error starting webcam:', error);
        hideLoadingScreen();
        
        // Show camera permissions UI for permission errors
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            if (cameraPermissions) {
                cameraPermissions.style.display = 'flex';
            }
        } else {
            showErrorMessage('Camera Error', error.message || 'Could not access camera');
        }
    }
}

// Show error message in results area
function showErrorMessage(title, message) {
    results.innerHTML = `
        <div class="error-message">
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

// Stop the webcam
function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        
        // Clear canvas
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        
        // Stop detection interval
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }
        
        // Reset the video container glow
        const videoContainer = document.querySelector('.video-container');
        videoContainer.style.boxShadow = '';
        
        // Enable/disable buttons
        startButton.disabled = false;
        stopButton.disabled = true;
        snapshotButton.disabled = true;
        
        // Clear results
        results.innerHTML = '<p class="no-results">Start the camera and detection to see results</p>';
        
        showSuccessNotification('Camera Stopped');
    }
}

// Start face detection with performance adjustments for mobile
function startDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    
    faceDetectionStartTime = performance.now();
    lastPerformanceLog = faceDetectionStartTime;
    
    // Adjust detection interval based on device type
    // Mobile devices need a slower interval to prevent performance issues
    const detectionSpeed = isMobileDevice ? 300 : 100; // ms between detections
    
    detectionInterval = setInterval(async () => {
        if (isProcessing || !video.readyState || !isModelLoaded) return;
        
        isProcessing = true;
        
        try {
            // Only log performance periodically to avoid console spam
            const now = performance.now();
            if (now - lastPerformanceLog > performanceInterval) {
                console.log(`Face detection running for ${((now - faceDetectionStartTime)/1000).toFixed(1)} seconds`);
                lastPerformanceLog = now;
            }
            
            const detection = await detectFaces();
            displayResults(detection);
        } catch (error) {
            console.error('Detection error:', error);
        } finally {
            isProcessing = false;
        }
    }, detectionSpeed);
}

// Detect faces in the current video frame
async function detectFaces() {
    // Adjust input size based on device type for better performance on mobile
    const inputSize = isMobileDevice ? 224 : 320;
    
    const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: inputSize,
        scoreThreshold: parseFloat(minConfidence.value)
    });
    
    let detection;
    const type = detectionType.value;
    
    try {
        // On mobile, we might want to simplify detection to improve performance
        if (isMobileDevice && type === 'expressions') {
            // For expressions on mobile, we'll use a simplified approach
            detection = await faceapi.detectAllFaces(video, options)
                .withFaceLandmarks(true) // Use lightweight model if available
                .withFaceExpressions();
        } else {
            switch (type) {
                case 'landmarks':
                    detection = await faceapi.detectAllFaces(video, options)
                        .withFaceLandmarks();
                    break;
                case 'expressions':
                    detection = await faceapi.detectAllFaces(video, options)
                        .withFaceLandmarks()
                        .withFaceExpressions();
                    break;
                case 'face':
                default:
                    detection = await faceapi.detectAllFaces(video, options);
                    break;
            }
        }
        return detection;
    } catch (error) {
        console.error('Error during face detection:', error);
        return [];
    }
}

// Display detection results on canvas and update results div
function displayResults(detections) {
    // Make sure canvas and video dimensions match exactly
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        console.log(`Adjusted canvas to: ${overlay.width}x${overlay.height}`);
    }
    
    // Clear previous drawings
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Get the detection type
    const type = detectionType.value;
    
    // Define display size explicitly from video dimensions
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    
    // Debug video and face location info (only log occasionally to avoid console spam)
    if (performance.now() - lastPerformanceLog > performanceInterval) {
        console.log(`Video size: ${displaySize.width}x${displaySize.height}`);
        console.log(`Detections found: ${detections.length}`);
    }
    
    // Calculate scale factors in case the video display size differs from actual video dimensions
    const videoEl = document.getElementById('video');
    const scaleX = videoEl.offsetWidth / displaySize.width;
    const scaleY = videoEl.offsetHeight / displaySize.height;
    
    // Resize detections to match display size
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    // Create results HTML
    let resultsHTML = '';
    
    // Draw differently based on detection type
    if (resizedDetections.length > 0) {
        resizedDetections.forEach((detection, index) => {
            // Get the box coordinates - handle different object structures
            let box;
            if (detection.detection) {
                box = detection.detection.box;
            } else if (detection.box) {
                box = detection.box;
            } else {
                console.error('Unexpected detection format:', detection);
                return;
            }
            
            // Calculate optimal box dimensions using height as reference
            // Most faces are taller than they are wide, so use height as base dimension
            // and reduce the width to 90% of height for better face alignment
            const baseHeight = box.height;
            const adjustedWidth = baseHeight * 0.9; // Make width 90% of height for better face alignment
            
            // Calculate the difference to center the box properly
            const widthDiff = adjustedWidth - box.width;
            
            // Apply padding as a percentage of height for consistency
            const padding = baseHeight * 0.15;
            
            // Create a properly proportioned box centered on the face
            const adjustedBox = {
                x: box.x - (widthDiff / 2),
                y: box.y,
                width: adjustedWidth,
                height: baseHeight
            };
            
            // Animate detection by creating a pulse/glow effect
            // Reduce animation intensity on mobile for better performance
            const pulseIntensity = isMobileDevice 
                ? 0.5 // Less intense on mobile
                : (Math.sin(performance.now() / 500) + 1) / 2; // Value between 0 and 1
                
            const shadowBlur = isMobileDevice 
                ? 5 // Fixed value on mobile
                : 5 + (pulseIntensity * 15); // Value between 5 and 20
            
            // Draw adjusted bounding box with padding and glow effect
            ctx.strokeStyle = colors.box;
            ctx.lineWidth = 3;
            
            // Only apply shadow effects on desktop for better performance
            if (!isMobileDevice) {
                ctx.shadowColor = pulseIntensity > 0.8 ? colors.boxHover : colors.box;
                ctx.shadowBlur = shadowBlur;
            }
            
            ctx.strokeRect(
                adjustedBox.x - padding,
                adjustedBox.y - padding, 
                adjustedBox.width + (padding * 2), 
                adjustedBox.height + (padding * 2)
            );
            
            // Reset shadow for other drawings
            ctx.shadowBlur = 0;
            
            // Add cyberpunk style face ID
            ctx.fillStyle = colors.box;
            ctx.font = isMobileDevice ? '14px Montserrat' : 'bold 16px Montserrat';
            ctx.fillText(`ID:${index + 1}-SCAN`, adjustedBox.x - padding, adjustedBox.y - 10);
            
            // Add neural network confidence value
            const confidenceText = `Conf: ${(box.score * 100).toFixed(0)}%`;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const confWidth = ctx.measureText(confidenceText).width + 20;
            ctx.fillRect(adjustedBox.x - padding, adjustedBox.y - 40, confWidth, 25);
            ctx.fillStyle = colors.box;
            ctx.fillText(confidenceText, adjustedBox.x - padding + 10, adjustedBox.y - 22);
            
            // Add cyberpunk frame corners on desktop only (performance optimization for mobile)
            if (!isMobileDevice) {
                const cornerSize = 15;
                const cornerWidth = 3;
                // Top left corner
                drawCorner(adjustedBox.x - padding, adjustedBox.y - padding, cornerSize, cornerWidth, 'top-left');
                // Top right corner
                drawCorner(adjustedBox.x - padding + adjustedBox.width + (padding * 2), adjustedBox.y - padding, cornerSize, cornerWidth, 'top-right');
                // Bottom left corner
                drawCorner(adjustedBox.x - padding, adjustedBox.y - padding + adjustedBox.height + (padding * 2), cornerSize, cornerWidth, 'bottom-left');
                // Bottom right corner
                drawCorner(adjustedBox.x - padding + adjustedBox.width + (padding * 2), adjustedBox.y - padding + adjustedBox.height + (padding * 2), cornerSize, cornerWidth, 'bottom-right');
            }
            
            // Add to results HTML
            resultsHTML += `<div class="result-item">
                <span>ID:${index + 1}-SCAN</span>
                <span>Confidence: ${(box.score * 100).toFixed(0)}%</span>
            </div>`;
            
            // Draw facial landmarks if available
            if (type === 'landmarks' && detection.landmarks) {
                // Draw all face points
                ctx.fillStyle = colors.landmarks;
                
                // Make landmarks more visible with larger dots
                const points = detection.landmarks.positions;
                const dotSize = isMobileDevice ? 2 : 3; // Smaller dots on mobile
                
                for (let i = 0; i < points.length; i++) {
                    ctx.beginPath();
                    // Draw at the exact detected position
                    ctx.arc(points[i].x, points[i].y, dotSize, 0, 2 * Math.PI);
                    ctx.fill();
                }
                
                // Add landmarks info to results
                resultsHTML += `<div class="result-item">
                    <span>Face ${index + 1} Landmarks</span>
                    <span>${points.length} points</span>
                </div>`;
            }
            
            // Draw expressions if available
            if (type === 'expressions' && detection.expressions) {
                const expressions = detection.expressions;
                const expressionArr = Object.entries(expressions);
                const topExpression = expressionArr.reduce((prev, current) => 
                    prev[1] > current[1] ? prev : current
                );
                
                // Use the expression value in a cyberpunk style panel
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(adjustedBox.x - padding, adjustedBox.y + adjustedBox.height + padding - 24, adjustedBox.width + (padding * 2), 24);
                
                // On desktop, use gradient text for expressions
                if (!isMobileDevice) {
                    // Gradient text for the expression name
                    const gradient = ctx.createLinearGradient(
                        adjustedBox.x - padding + 5,
                        adjustedBox.y + adjustedBox.height + padding - 6,
                        adjustedBox.x - padding + 5 + 200,
                        adjustedBox.y + adjustedBox.height + padding - 6
                    );
                    gradient.addColorStop(0, '#00ffff');
                    gradient.addColorStop(1, '#ff00ff');
                    ctx.fillStyle = gradient;
                } else {
                    // Solid color on mobile for better performance
                    ctx.fillStyle = colors.box;
                }
                
                ctx.font = isMobileDevice ? '14px Montserrat' : '16px Montserrat';
                ctx.fillText(
                    `${topExpression[0]}: ${(topExpression[1] * 100).toFixed(0)}%`, 
                    adjustedBox.x - padding + 5, 
                    adjustedBox.y + adjustedBox.height + padding - 6
                );
                
                // Add expressions to results
                resultsHTML += `<div class="result-item">
                    <span>Face ${index + 1} Expressions</span>
                    <span>${topExpression[0]} (${(topExpression[1] * 100).toFixed(0)}%)</span>
                </div>`;
            }
        });
    } else {
        resultsHTML = '<p class="no-results">No faces detected</p>';
    }
    
    // Update results div
    results.innerHTML = resultsHTML;
}

// Draw a cyberpunk corner bracket
function drawCorner(x, y, size, width, position) {
    ctx.strokeStyle = colors.box;
    ctx.lineWidth = width;
    ctx.beginPath();
    
    switch (position) {
        case 'top-left':
            ctx.moveTo(x, y + size);
            ctx.lineTo(x, y);
            ctx.lineTo(x + size, y);
            break;
        case 'top-right':
            ctx.moveTo(x, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x - size, y);
            break;
        case 'bottom-left':
            ctx.moveTo(x, y - size);
            ctx.lineTo(x, y);
            ctx.lineTo(x + size, y);
            break;
        case 'bottom-right':
            ctx.moveTo(x, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x - size, y);
            break;
    }
    
    ctx.stroke();
}

// Take a snapshot from the current video frame
function takeSnapshot() {
    if (!stream) return;
    if (isMobileDevice && (!video.videoWidth || !video.videoHeight)) {
        showErrorMessage('Snapshot Error', 'Camera not ready. Please try again.');
        return;
    }
    // Capture the snapshot first (no shutter effect on canvas)
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = video.videoWidth;
    snapshotCanvas.height = video.videoHeight;
    const snapshotCtx = snapshotCanvas.getContext('2d');
    // On iOS/Android, force a reflow to ensure the video frame is ready
    if (isMobileDevice) {
        video.pause();
        video.play();
    }
    snapshotCtx.drawImage(video, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    snapshotCtx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    snapshotCtx.fillRect(0, 0, snapshotCanvas.width, snapshotCanvas.height);
    snapshotCtx.drawImage(overlay, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    const dataUrl = snapshotCanvas.toDataURL('image/jpeg', isMobileDevice ? 0.7 : 1.0);
    // Add snapshot to snapshots array
    const snapshotId = snapshots.length > 0 ? snapshots[snapshots.length - 1].id + 1 : 1;
    snapshots.push({
        id: snapshotId,
        dataUrl: dataUrl,
        timestamp: new Date().toISOString()
    });
    updateSnapshotsDisplay();
    // Trigger download
    const downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    downloadLink.download = `snapshot-${Date.now()}.jpg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    // Now show the shutter effect visually (does not affect snapshot)
    addShutterEffect();
    showSuccessNotification('Snapshot taken');
}

// Update snapshots display
function updateSnapshotsDisplay() {
    if (snapshots.length === 0) {
        snapshotsContainer.innerHTML = '<p class="no-results">No snapshots taken yet</p>';
        return;
    }
    let html = '';
    const displaySnapshots = isMobileDevice ? snapshots.slice(-12) : snapshots;
    displaySnapshots.forEach(snapshot => {
        html += `
            <div class="snapshot-item" id="snapshot-${snapshot.id}">
                <img src="${snapshot.dataUrl}" alt="Snapshot from ${snapshot.timestamp}" title="${snapshot.timestamp}">
                <a class="download-btn" href="${snapshot.dataUrl}" download="snapshot-${snapshot.id}.jpg" title="Download snapshot">
                    <i class="fas fa-download"></i>
                </a>
                <button class="delete-btn" onclick="deleteSnapshot(${snapshot.id})" aria-label="Delete snapshot">
                    <i class="fas fa-trash"></i>
                </button>
                <div class="snapshot-timestamp">${formatTimestamp(snapshot.timestamp)}</div>
            </div>
        `;
    });
    snapshotsContainer.innerHTML = html;
    const newSnapshot = document.getElementById(`snapshot-${snapshots[snapshots.length - 1].id}`);
    if (newSnapshot) {
        newSnapshot.classList.add('fade-in');
    }
}

// Delete a snapshot by ID
function deleteSnapshot(id) {
    snapshots = snapshots.filter(snapshot => snapshot.id !== id);
    updateSnapshotsDisplay();
    showSuccessNotification(`Snapshot ${id} deleted`);
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

// Add a camera shutter effect
function addShutterEffect() {
    // Create a temporary canvas to draw the shutter effect
    const shutterCanvas = document.createElement('canvas');
    shutterCanvas.width = video.videoWidth;
    shutterCanvas.height = video.videoHeight;
    const shutterCtx = shutterCanvas.getContext('2d');
    
    // Draw a white rectangle over the video
    shutterCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    shutterCtx.fillRect(0, 0, shutterCanvas.width, shutterCanvas.height);
    
    // Add a quick fade-out animation
    shutterCtx.globalAlpha = 0.8;
    shutterCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    shutterCtx.fillRect(0, 0, shutterCanvas.width, shutterCanvas.height);
    
    // Draw the shutter effect on the main canvas
    ctx.drawImage(shutterCanvas, 0, 0);
    
    // Remove the temporary canvas
    shutterCanvas.remove();
}

// Event listeners
startButton.addEventListener('click', () => {
    startWebcam();
});

stopButton.addEventListener('click', () => {
    stopWebcam();
});

snapshotButton.addEventListener('click', () => {
    takeSnapshot();
});

// Initialize app
checkMobileDevice();
loadModels();