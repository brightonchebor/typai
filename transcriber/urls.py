from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('upload/', views.upload_page, name='upload_page'),
    path('realtime/', views.realtime_page, name='realtime_page'),
    path('api/upload-audio/', views.upload_audio, name='upload_audio'),
]