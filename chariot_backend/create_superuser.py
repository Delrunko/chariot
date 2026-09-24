import os
import django
import sys

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chariot_backend.settings')
django.setup()

from accounts.models import Utilisateur

# Identifiants du superuser (modifiez-les)
USERNAME = 'Dombou'
EMAIL = ''
PASSWORD = 'dombou123!'

def create_superuser():
    if Utilisateur.objects.filter(username=USERNAME).exists():
        print(f"Le superuser '{USERNAME}' existe déjà.")
    else:
        Utilisateur.objects.create_superuser(
            username=USERNAME,
            email=EMAIL,
            password=PASSWORD
        )
        print(f"Superuser '{USERNAME}' créé avec succès.")

if __name__ == '__main__':
    create_superuser()