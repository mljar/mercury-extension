import sys

from mercury_app.app import main
from ._version import __version__
logo = """                            

     _ __ ___   ___ _ __ ___ _   _ _ __ _   _ 
    | '_ ` _ \ / _ \ '__/ __| | | | '__| | | |
    | | | | | |  __/ | | (__| |_| | |  | |_| |
    |_| |_| |_|\___|_|  \___|\__,_|_|   \__, |
                                         __/ |
                                        |___/ 
"""
        

if __name__ == "__main__":
    print(logo)
    print(f"Version: {__version__}")
    sys.exit(main())

#python -m mercury_app --IdentityProvider.token='' --ServerApp.log_level='CRITICAL' --LabApp.log_level='CRITICAL' --Application.log_level='CRITICAL' \

# ServerApp.password config is deprecated in 2.0. Use PasswordIdentityProvider.hashed_password.

#python -m mercury_app --IdentityProvider.token='' --SeverApp.password_required=True --ServerApp.password='argon2:$argon2id$v=19$m=10240,t=10,p=8$wBD9q70iNsTBFjYPuJcpfg$C/+zJzoESxrOoYCY4oFLWGPMXjm+fnwdqA7DsL8o+IY'
