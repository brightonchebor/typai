/**
 * Real-time transcription using WebSockets and AudioRecorder
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startButton = document.getElementById('startRecording');
    const stopButton = document.getElementById('stopRecording');
    const transcriptionOutput = document.getElementById('transcriptionOutput');
    const recordingStatus = document.getElementById('recordingStatus');
    const listeningStatus = document.getElementById('listeningStatus');
    const processingStatus = document.getElementById('processingStatus');
    
    // WebSocket connection
    let socket = null;
    
    // Audio recorder instance
    let recorder = null;
    
    // Additional variables
    let isTranscribing = false;
    let chunkCounter = 0;  // To track when to send chunks for processing
    const chunkInterval = 1000;  // Send chunks every 1 second
    let lastChunkTime = 0;
    
    // Function to setup the WebSocket connection
    function setupWebSocket() {
        // Close existing connection if any
        if (socket) {
            socket.close();
        }
        
        // Create a new WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/transcribe/`;
        
        socket = new WebSocket(wsUrl);
        
        // WebSocket event handlers
        socket.onopen = function(e) {
            console.log('WebSocket connection established');
        };
        
        socket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            
            if (data.type === 'transcription') {
                // Update the transcription output
                if (data.text) {
                    if (data.final) {
                        // Final transcription - append with new paragraph
                        const existingText = transcriptionOutput.innerHTML;
                        transcriptionOutput.innerHTML = existingText + 
                            (existingText ? '<br><br>' : '') + 
                            data.text;
                        
                        // Update status indicators
                        processingStatus.classList.add('d-none');
                        listeningStatus.classList.remove('d-none');
                    } else {
                        // Interim transcription - update in place
                        const paragraphs = transcriptionOutput.innerHTML.split('<br><br>');
                        if (paragraphs.length > 0) {
                            // Replace the last paragraph with the new text
                            paragraphs[paragraphs.length - 1] = data.text;
                            transcriptionOutput.innerHTML = paragraphs.join('<br><br>');
                        } else {
                            transcriptionOutput.innerHTML = data.text;
                        }
                    }
                }
            }
        };
        
        socket.onclose = function(e) {
            console.log('WebSocket connection closed', e);
            if (isTranscribing) {
                // Try to reconnect if we were actively transcribing
                setTimeout(setupWebSocket, 1000);
            }
        };
        
        socket.onerror = function(e) {
            console.error('WebSocket error:', e);
        };
        
        return socket;
    }
    
    // Function to process audio chunks and send to server
    function processAudioChunk(audioData) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        
        const now = Date.now();
        if (now - lastChunkTime >= chunkInterval) {
            // Convert to base64 and send
            const base64Data = AudioRecorder.float32ToBase64(audioData);
            
            socket.send(JSON.stringify({
                type: 'audio_data',
                data: base64Data
            }));
            
            lastChunkTime = now;
            
            // Update status indicators occasionally
            chunkCounter++;
            if (chunkCounter % 3 === 0) {
                listeningStatus.classList.add('d-none');
                processingStatus.classList.remove('d-none');
            } else {
                processingStatus.classList.add('d-none');
                listeningStatus.classList.remove('d-none');
            }
        }
    }
    
    // Start recording and transcribing
    startButton.addEventListener('click', async function() {
        try {
            // Initialize WebSocket if needed
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                socket = setupWebSocket();
            }
            
            // Create recorder instance
            recorder = new AudioRecorder({
                onAudioProcess: processAudioChunk
            });
            
            // Start recording
            await recorder.start();
            
            // Update UI
            startButton.classList.add('d-none');
            stopButton.classList.remove('d-none');
            recordingStatus.classList.add('d-none');
            listeningStatus.classList.remove('d-none');
            
            isTranscribing = true;
            chunkCounter = 0;
            lastChunkTime = Date.now();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone. Please check your permissions and try again.');
        }
    });
    
    // Stop recording
    stopButton.addEventListener('click', function() {
        if (recorder) {
            recorder.stop();
        }
        
        // Send end stream signal to server
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'end_stream'
            }));
        }
        
        // Update UI
        stopButton.classList.add('d-none');
        startButton.classList.remove('d-none');
        listeningStatus.classList.add('d-none');
        processingStatus.classList.remove('d-none');
        
        isTranscribing = false;
    });
    
    // Handle page unload - cleanup
    window.addEventListener('beforeunload', function() {
        if (recorder) {
            recorder.stop();
        }
        
        if (socket) {
            socket.close();
        }
    });
});