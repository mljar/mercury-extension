import sys
import subprocess
import psutil
import secrets

from django.utils import timezone
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
        notebook = self.get_object()
        if notebook.status == 'running':
            return Response({'detail': 'Already running', 'url': f'http://localhost:{notebook.port}', 'token': notebook.token})

        port = find_free_port()
        token = secrets.token_urlsafe(32)
        now = timezone.now()

        cmd = [
            sys.executable, "-m", "mercury_app", notebook.file_path,
            f"--port={port}",
            "--MercuryApp.timeout=600",
            #"--no-browser",
            f"--NotebookApp.token={token}",
        ]
        print(cmd)
        process = subprocess.Popen(cmd)
        notebook.port = port
        notebook.pid = process.pid
        notebook.status = 'running'
        notebook.token = token
        notebook.started_at = now
        notebook.save()
        return Response({'url': f'http://localhost:{port}', 'token': token, 'started_at': now})


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
        notebook.save()
        return Response({'status': 'stopped'})
