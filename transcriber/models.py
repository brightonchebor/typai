from django.db import models

class AudioFile(models.Model):
    file = models.FileField(upload_to='audio_uploads/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Audio {self.id} - {self.uploaded_at}"

class Transcription(models.Model):
    audio = models.ForeignKey(AudioFile, on_delete=models.CASCADE, related_name='transcriptions')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Transcription for Audio {self.audio.id}"