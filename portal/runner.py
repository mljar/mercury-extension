
def main():
    print('portal runner')

#python -m mercury_app --IdentityProvider.token='' --ServerApp.log_level='CRITICAL' --LabApp.log_level='CRITICAL' --Application.log_level='CRITICAL' \

# ServerApp.password config is deprecated in 2.0. Use PasswordIdentityProvider.hashed_password.

#python -m mercury_app --IdentityProvider.token='' --SeverApp.password_required=True --ServerApp.password='argon2:$argon2id$v=19$m=10240,t=10,p=8$wBD9q70iNsTBFjYPuJcpfg$C/+zJzoESxrOoYCY4oFLWGPMXjm+fnwdqA7DsL8o+IY'
