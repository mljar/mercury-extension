
import os
import sys
import subprocess
import psutil
import secrets
import requests 
import tempfile
import threading
import time
 
from django.utils import timezone
from django.db import transaction
from django.db import OperationalError
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import mixins, viewsets
from .models import Notebook
from .serializers import NotebookSerializer

def find_free_port(start=9000, end=9999):
    import socket
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
    raise RuntimeError("No free ports available")



class NotebookViewSet(mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      viewsets.GenericViewSet):
    """
    Allows only GET (list/retrieve) on notebooks via the API.
    No POST, PUT, PATCH, DELETE.
    """
    queryset = Notebook.objects.all()
    serializer_class = NotebookSerializer

    @action(detail=True, methods=['post'])
    def launch(self, request, pk=None):
        print(f"LAUNCH REQUEST {time.time()} {threading.get_ident()} for notebook {pk}")
        
        def _cleanup(notebook):
            notebook.status = 'stopped'
            notebook.port = None
            notebook.pid = None
            notebook.token = None
            notebook.started_at = None
            notebook.save()

        def _is_process_alive(pid):
            try:
                proc = psutil.Process(pid)
                return proc.is_running()
            except psutil.NoSuchProcess:
                return False

        def _is_http_alive(url):
            try:
                resp = requests.head(url, timeout=2)
                # If we get any response, server is up (even 401 etc)
                return True
            except requests.RequestException:
                return False
        
        try:
            with transaction.atomic():
                # Lock notebook row to prevent concurrent launches
                notebook = Notebook.objects.select_for_update().get(pk=pk)
                filename = os.path.basename(notebook.file_path)

                # Check if an existing process is alive and HTTP is responsive
                if notebook.status == 'running' and notebook.pid:
                    url = f'http://localhost:{notebook.port}/mercury/{filename}?token={notebook.token}'
                    if _is_process_alive(notebook.pid) and _is_http_alive(url):
                        return Response({'detail': 'Already running', 'url': url, 'token': notebook.token})
                    else:
                        _cleanup(notebook)

                # Start a new notebook process
                port = find_free_port()
                token = secrets.token_urlsafe(32)
                now = timezone.now()
                url = f'http://localhost:{port}/mercury/{filename}?token={token}'

                cmd = [
                    sys.executable, "-m", "mercury_app", notebook.file_path,
                    f"--port={port}",
                    "--MercuryApp.timeout=10",
                    f"--ServerApp.token={token}",
                ]
                print("Launching new Mercury process:", cmd)

                process = subprocess.Popen(cmd)
                notebook.port = port
                notebook.pid = process.pid
                notebook.status = 'running'
                notebook.token = token
                notebook.started_at = now
                notebook.url = url 
                notebook.save()

                return Response({'url': url, 'token': token, 'started_at': now})
        except OperationalError as ex:
            return Response(
                {'error': 'Notebook server is busy. Please try again in a moment.'},
                status=status.HTTP_423_LOCKED
            )   


    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        notebook = self.get_object()
        if notebook.pid:
            try:
                p = psutil.Process(notebook.pid)
                p.terminate()
                try:
                    p.wait(timeout=3)
                except psutil.TimeoutExpired:
                    p.kill()
            except psutil.NoSuchProcess:
                pass
        notebook.status = 'stopped'
        notebook.pid = None
        notebook.port = None
        notebook.url = None  
        notebook.save()
        return Response({'status': 'stopped'})

