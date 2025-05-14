from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from .models import AudioFile, Transcription
from .transcriber import WhisperTranscriber
import logging
import json
import os

logger = logging.getLogger(__name__)

def index(request):
    """Home page view."""
    return render(request, 'index.html')

def upload_page(request):
    """Page for uploading audio files."""
    return render(request, 'upload.html')

def realtime_page(request):
    """Page for real-time transcription."""
    return render(request, 'realtime.html')

@csrf_exempt
def upload_audio(request):
    """Handle audio file uploads and transcribe them."""
    if request.method == 'POST' and request.FILES.get('audio_file'):
        audio_file = request.FILES['audio_file']
        
        # Save the uploaded file
        audio_obj = AudioFile(file=audio_file)
        audio_obj.save()
        
        # Get the file path
        file_path = os.path.join(settings.MEDIA_ROOT, audio_obj.file.name)
        
        try:
            # Transcribe the audio
            transcriber = WhisperTranscriber()
            transcription_text = transcriber.transcribe_file(file_path)
            
            # Save the transcription
            transcription = Transcription(audio=audio_obj, text=transcription_text)
            transcription.save()
            
            return JsonResponse({
                'success': True,
                'transcription': transcription_text,
                'transcription_id': transcription.id
            })
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)