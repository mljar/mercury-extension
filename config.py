c.Application.log_level = 'INFO'
c.VoilaExecutor.show_tracebacks = True

c.VoilaExecutor.on_cell_error = 'mercury_app.execute.on_cell_error'


#c.LabServerApp.NotebookClientClass = 'mercury_app.execute.VoilaExecutor'