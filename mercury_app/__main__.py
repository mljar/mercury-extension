import sys
import logging
import argparse

from ._version import __version__

logo = r"""                            

     _ __ ___   ___ _ __ ___ _   _ _ __ _   _ 
    | '_ ` _ \ / _ \ '__/ __| | | | '__| | | |
    | | | | | |  __/ | | (__| |_| | |  | |_| |
    |_| |_| |_|\___|_|  \___|\__,_|_|   \__, |
                                         __/ |
                                        |___/ 
"""

LEVEL_NAMES = ["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG", "NOTSET"]

def _parse_and_inject(argv):
    """
    Parse --log-level and inject:
    - ServerApp.log_level
    - LabApp.log_level
    - Application.log_level
    - ServerApp.token='' (only if NO user token provided)
    """
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--log-level", choices=LEVEL_NAMES, default="CRITICAL")
    ns, rest = parser.parse_known_args(argv[1:])

    level_name = ns.log_level.upper()
    level_no = getattr(logging, level_name, logging.CRITICAL)

    new_argv = [argv[0]] + rest

    # Inject log levels
    if not any(a.startswith("--ServerApp.log_level") for a in new_argv):
        new_argv.append(f"--ServerApp.log_level={level_no}")
    if not any(a.startswith("--LabApp.log_level") for a in new_argv):
        new_argv.append(f"--LabApp.log_level={level_no}")
    if not any(a.startswith("--Application.log_level") for a in new_argv):
        new_argv.append(f"--Application.log_level={level_no}")

    # Only inject empty token if user provided none
    user_set_token = any(
        a.startswith("--ServerApp.token") or
        a.startswith("--IdentityProvider.token") or
        a.startswith("--token")
        for a in new_argv
    )
    if not user_set_token:
        new_argv.append("--IdentityProvider.token=''")

    new_argv.append("--ContentsManager.allow_hidden=True")
    new_argv.append("--MappingKernelManager.default_kernel_name='python3'")
    

    return new_argv

if __name__ == "__main__":
    # display logo and version
    print(logo)
    print(f"Version: {__version__}")
    # parse and inject arguments
    sys.argv = _parse_and_inject(sys.argv)
    # start mercury server
    from mercury_app.app import main 
    sys.exit(main())
