import os
import numpy as np
import tempfile
from django.conf import settings
from faster_whisper import WhisperModel
from pydub import AudioSegment
import logging

logger = logging.getLogger(__name__)

class WhisperTranscriber:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WhisperTranscriber, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize the Whisper model."""
        self.model_size = getattr(settings, "WHISPER_MODEL_SIZE", "base")
        self.device = getattr(settings, "WHISPER_DEVICE", "cpu")
        self.compute_type = getattr(settings, "WHISPER_COMPUTE_TYPE", "float32")
        
        logger.info(f"Loading Whisper model: {self.model_size} on {self.device} with {self.compute_type}")
        self.model = WhisperModel(
            self.model_size, 
            device=self.device, 
            compute_type=self.compute_type
        )
        logger.info("Whisper model loaded successfully")
    
    def transcribe_file(self, file_path):
        """Transcribe an audio file."""
        logger.info(f"Transcribing file: {file_path}")
        segments, info = self.model.transcribe(file_path, beam_size=5)
        
        transcription = " ".join([segment.text for segment in segments])
        logger.info(f"Transcription completed. Length: {len(transcription)}")
        return transcription
    
    def transcribe_buffer(self, audio_buffer, sample_rate=16000):
        """Transcribe audio from a buffer (numpy array)."""
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            # Convert numpy array to AudioSegment
            audio_segment = AudioSegment(
                data=audio_buffer.tobytes(),
                sample_width=2,  # 16-bit audio
                frame_rate=sample_rate,
                channels=1  # Mono
            )
            audio_segment.export(temp_file.name, format="wav")
        
        # Transcribe the temporary file
        try:
            result = self.transcribe_file(temp_file.name)
            return result
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)

    def transcribe_chunks_with_vad(self, audio_chunks, sample_rate=16000):
        """
        Transcribe audio chunks with Voice Activity Detection.
        Returns the transcription when silence is detected.
        """
        # Concatenate chunks into a single buffer
        if not audio_chunks:
            return ""
            
        # Convert list of chunks to a single numpy array
        audio_data = np.concatenate(audio_chunks)
        
        # Use VAD to detect speech segments
        return self.transcribe_buffer(audio_data, sample_rate)