import os
import sys
import time
import secrets
import requests
import psutil
import subprocess
import threading
import logging
from django.utils import timezone
from notebooks.models import Notebook

logger = logging.getLogger(__name__)

def find_free_port(start=9000, end=9999):
    import socket
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
    raise RuntimeError("No free ports available")

# Lock timeout in seconds
LAUNCHER_LOCK_TIMEOUT = 3

# Global in-memory PID registry {notebook_pk: pid}
LAUNCHER_PID_REGISTRY = {}
LAUNCHER_PID_REGISTRY_LOCK = threading.Lock()

class NotebookLauncher:
    def launch(self, notebook):
        raise NotImplementedError
    def stop(self, notebook):
        raise NotImplementedError

class DefaultNotebookLauncher(NotebookLauncher):
    def __init__(self):
        self.pid_registry = LAUNCHER_PID_REGISTRY
        self.registry_lock = LAUNCHER_PID_REGISTRY_LOCK

    def launch(self, notebook):
        logger.info(self.pid_registry)

        def _cleanup(n):
            logger.info(f"[{threading.get_ident()}] Cleaning up notebook {n.pk}")
            n.status = 'stopped'
            n.port = None
            n.pid = None
            n.token = None
            n.started_at = None
            n.url = None
            n.save()

        def _is_process_alive(pid):
            try:
                proc = psutil.Process(pid)
                alive = proc.is_running()
                logger.info(f"[{threading.get_ident()}] Checking if PID {pid} is alive: {alive}")
                return alive
            except psutil.NoSuchProcess:
                logger.info(f"[{threading.get_ident()}] PID {pid} does not exist.")
                return False

        def _is_http_alive(url, tries=3, delay=0.5):
            for attempt in range(tries):
                try:
                    resp = requests.get(url, timeout=1)
                    logger.info(f"[{threading.get_ident()}] HTTP check for {url}: {resp.status_code}")
                    return True
                except requests.RequestException as e:
                    logger.warning(f"[{threading.get_ident()}] HTTP check for {url} failed (attempt {attempt+1}/{tries}): {e}")
                    time.sleep(delay)
            return False

        filename = os.path.basename(notebook.file_path)
        logger.info(f"[{threading.get_ident()}] Launch requested for notebook {notebook.pk}")

        acquired = self.registry_lock.acquire(timeout=LAUNCHER_LOCK_TIMEOUT)
        if not acquired:
            logger.warning(f"[{threading.get_ident()}] Could not acquire launcher lock for notebook {notebook.pk} within {LAUNCHER_LOCK_TIMEOUT}s!")
            return {'detail': 'Could not acquire lock, try again later'}
        try:
            logger.info(f"[{threading.get_ident()}] Acquired launcher lock for notebook {notebook.pk}")
            # Atomic status update to avoid race
            num_updated = Notebook.objects.filter(pk=notebook.pk, status='stopped').update(status='launching')
            logger.info(f"[{threading.get_ident()}] Tried to update notebook {notebook.pk} to 'launching': rows affected = {num_updated}")
            if num_updated == 0:
                # Someone else is launching or it's running
                notebook.refresh_from_db()
                logger.info(f"[{threading.get_ident()}] Notebook {notebook.pk} is not stopped (status: {notebook.status})")
                existing_pid = self.pid_registry.get(notebook.pk)
                if existing_pid is None:
                    _cleanup(notebook)
                else:
                    logger.info(f'Existing PID {existing_pid}')
                    if notebook.status == 'running' and existing_pid:
                        url = f'http://localhost:{notebook.port}/mercury/{filename}?token={notebook.token}'
                        if _is_process_alive(existing_pid) and _is_http_alive(url):
                            logger.info(f"[{threading.get_ident()}] Notebook {notebook.pk} is already running at {url}")
                            return {'detail': 'Already running', 'url': url, 'token': notebook.token}
                        else:
                            logger.info(f"[{threading.get_ident()}] Notebook {notebook.pk} has stale state, cleaning up.")
                            _cleanup(notebook)
                    logger.info(f"[{threading.get_ident()}] Notebook {notebook.pk} is already launching or running.")
                    return {'detail': 'Already launching/running, try again later'}

            logger.info(f"[{threading.get_ident()}] Notebook {notebook.pk} locked for launching by this thread.")

            # At this point, *this* thread is the only one allowed to launch
            notebook.refresh_from_db()
            logger.info(f"[{threading.get_ident()}] Refreshed notebook {notebook.pk} from DB.")

            # Start new process
            port = find_free_port()
            token = secrets.token_urlsafe(32)
            now = timezone.now()
            url = f'http://localhost:{port}/mercury/{filename}?token={token}'
            cmd = [
                sys.executable, "-m", "mercury_app", notebook.file_path,
                f"--port={port}",
                "--MercuryApp.timeout=10",
                "--no-browser",
                f"--IdentityProvider.token=''", #{token}",
                "--ServerApp.disable_check_xsrf=True",
                #"--ServerApp.allow_remote_access=True",
                #"--ServerApp.allow_origin=http://127.0.0.1:8000",
            ]
            logger.info(f"[{threading.get_ident()}] Launching new Mercury process for notebook {notebook.pk}: {cmd}")
            try:
                process = subprocess.Popen(cmd)
                notebook.port = port
                notebook.pid = process.pid
                notebook.status = 'running'
                notebook.token = token
                notebook.started_at = now
                notebook.url = url
                notebook.save()
                self.pid_registry[notebook.pk] = process.pid
                logger.info(f"[{threading.get_ident()}] Notebook {notebook.pk} launched with PID {process.pid} at {url}")
                return {'url': url, 'token': token, 'started_at': now}
            except Exception as ex:
                logger.error(f"[{threading.get_ident()}] Failed to launch Mercury process for notebook {notebook.pk}: {ex}")
                # Roll back to stopped if launching fails
                _cleanup(notebook)
                return {'detail': f'Failed to launch: {ex}'}
        finally:
            self.registry_lock.release()

    def stop(self, notebook):
        logger.info(f"[{threading.get_ident()}] Stop requested for notebook {notebook.pk}")
        acquired = self.registry_lock.acquire(timeout=LAUNCHER_LOCK_TIMEOUT)
        if not acquired:
            logger.warning(f"[{threading.get_ident()}] Could not acquire launcher lock for stop within {LAUNCHER_LOCK_TIMEOUT}s!")
            return {'detail': 'Could not acquire lock to stop, try again later'}
        try:
            pid = self.pid_registry.pop(notebook.pk, None)
        finally:
            self.registry_lock.release()
        if pid:
            try:
                logger.info(f"[{threading.get_ident()}] Terminating PID {pid} for notebook {notebook.pk}")
                p = psutil.Process(pid)
                p.terminate()
                try:
                    p.wait(timeout=3)
                    logger.info(f"[{threading.get_ident()}] Process {pid} terminated gracefully.")
                except psutil.TimeoutExpired:
                    logger.warning(f"[{threading.get_ident()}] Killing process {pid} after timeout.")
                    p.kill()
            except psutil.NoSuchProcess:
                logger.info(f"[{threading.get_ident()}] Process {pid} for notebook {notebook.pk} does not exist.")
        notebook.status = 'stopped'
        notebook.pid = None
        notebook.port = None
        notebook.url = None
        notebook.save()
        logger.info(f"[{threading.get_ident()}] Notebook {notebook.pk} stopped and cleaned up.")
