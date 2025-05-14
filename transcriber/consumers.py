import json
import numpy as np
import base64
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .transcriber import WhisperTranscriber

logger = logging.getLogger(__name__)

class TranscriptionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handle WebSocket connection."""
        await self.accept()
        self.audio_chunks = []
        self.silent_chunks = 0
        self.transcriber = WhisperTranscriber()
        logger.info("WebSocket connection established")
        
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        logger.info(f"WebSocket connection closed with code: {close_code}")
        
    async def receive(self, text_data=None, bytes_data=None):
        """Handle receiving data from WebSocket."""
        if text_data:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'audio_data':
                # Convert base64 audio data to numpy array
                audio_data = base64.b64decode(data['data'])
                audio_array = np.frombuffer(audio_data, dtype=np.float32)
                
                # Check if this is silence (check average amplitude)
                is_silence = np.abs(audio_array).mean() < 0.01
                
                if is_silence:
                    self.silent_chunks += 1
                    # If we've detected 4 consecutive silent chunks (roughly 4 seconds at 1s chunks)
                    if self.silent_chunks >= 4 and self.audio_chunks:
                        # Process accumulated audio chunks
                        transcription = await self.transcribe_chunks()
                        await self.send(text_data=json.dumps({
                            'type': 'transcription',
                            'text': transcription,
                            'final': True
                        }))
                        # Reset for next utterance
                        self.audio_chunks = []
                else:
                    # Reset silence counter when speech is detected
                    self.silent_chunks = 0
                    self.audio_chunks.append(audio_array)
                    
                    # Provide interim results every 3 non-silent chunks
                    if len(self.audio_chunks) % 3 == 0:
                        transcription = await self.transcribe_chunks()
                        await self.send(text_data=json.dumps({
                            'type': 'transcription',
                            'text': transcription,
                            'final': False
                        }))
            
            elif message_type == 'end_stream':
                # Final transcription when user manually ends stream
                if self.audio_chunks:
                    transcription = await self.transcribe_chunks()
                    await self.send(text_data=json.dumps({
                        'type': 'transcription',
                        'text': transcription,
                        'final': True
                    }))
                self.audio_chunks = []
    
    @database_sync_to_async
    def transcribe_chunks(self):
        """Transcribe audio chunks (runs in a thread to avoid blocking the event loop)."""
        if not self.audio_chunks:
            return ""
        
        try:
            return self.transcriber.transcribe_chunks_with_vad(self.audio_chunks)
        except Exception as e:
            logger.error(f"Error transcribing audio chunks: {str(e)}")
            return "[Transcription error]"