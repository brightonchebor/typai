/**
 * Recorder.js - Simple audio recorder using Web Audio API
 */
class AudioRecorder {
    constructor(options = {}) {
        this.audioContext = null;
        this.stream = null;
        this.recording = false;
        this.processor = null;
        this.audioChunks = [];
        
        // Default options
        this.options = {
            sampleRate: 16000,  // Sample rate for Whisper model
            bufferSize: 4096,   // Buffer size for ScriptProcessor
            numChannels: 1,     // Mono recording
            onAudioProcess: null, // Callback for audio data
            ...options
        };
    }
    
    async start() {
        if (this.recording) return;
        
        try {
            // Get audio stream from user's microphone
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.options.sampleRate
            });
            
            // Create source node from the stream
            const source = this.audioContext.createMediaStreamSource(this.stream);
            
            // Create script processor node for processing audio data
            this.processor = this.audioContext.createScriptProcessor(
                this.options.bufferSize,
                this.options.numChannels,
                this.options.numChannels
            );
            
            // Connect the nodes
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            
            // Start recording
            this.recording = true;
            this.audioChunks = [];
            
            // Set up the onaudioprocess event handler
            this.processor.onaudioprocess = (e) => {
                if (!this.recording) return;
                
                // Get audio data from the buffer
                const audioData = e.inputBuffer.getChannelData(0);
                
                // Make a copy of the data
                const audioDataCopy = new Float32Array(audioData);
                this.audioChunks.push(audioDataCopy);
                
                // Call the callback if provided
                if (typeof this.options.onAudioProcess === 'function') {
                    this.options.onAudioProcess(audioDataCopy);
                }
            };
            
            return true;
        } catch (error) {
            console.error('Error starting recorder:', error);
            this.stop();
            throw error;
        }
    }
    
    stop() {
        if (!this.recording) return;
        
        this.recording = false;
        
        // Stop all tracks in the stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Disconnect and clean up processor node
        if (this.processor) {
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
            this.processor = null;
        }
        
        // Close the audio context
        if (this.audioContext) {
            if (this.audioContext.state !== 'closed' && typeof this.audioContext.close === 'function') {
                this.audioContext.close();
            }
            this.audioContext = null;
        }
        
        return this.audioChunks;
    }
    
    isRecording() {
        return this.recording;
    }
    
    getAudioChunks() {
        return this.audioChunks;
    }
    
    // Convert Float32Array data to base64 for sending over WebSockets
    static float32ToBase64(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 4);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Array.length; i++) {
            view.setFloat32(i * 4, float32Array[i], true);
        }
        
        // Convert to base64
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}