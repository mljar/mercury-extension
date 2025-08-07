

import threading
import time
 
from django.utils import timezone
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import mixins, viewsets
from .models import Notebook
from .serializers import NotebookSerializer
from .launchers import DefaultNotebookLauncher

class NotebookViewSet(mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      viewsets.GenericViewSet):
    """
    Allows only GET (list/retrieve) on notebooks via the API.
    No POST, PUT, PATCH, DELETE.
    """
    queryset = Notebook.objects.all()
    serializer_class = NotebookSerializer


    launcher = DefaultNotebookLauncher()

    @action(detail=True, methods=['post'])
    def launch(self, request, pk=None):
        print(f"LAUNCH REQUEST {time.time()} {threading.get_ident()} for notebook {pk}")

        notebook = self.get_object()
        try:
            res = self.launcher.launch(notebook)
            if 'detail' in res and res['detail'] == 'Already running':
                return Response(res)
            return Response(res)
        except Exception as ex:
            print("Launcher error:", ex)
            return Response({'error': str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        notebook = self.get_object()
        self.launcher.stop(notebook)
        return Response({'status': 'stopped'})
