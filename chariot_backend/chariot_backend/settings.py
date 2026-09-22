"""
Django settings for chariot_backend project.
"""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Sécurité : plus jamais de clé en dur dans le code une fois publié ---
# En local, si la variable SECRET_KEY n'est pas définie, on retombe sur une
# valeur de développement (jamais utilisée en production tant que la
# variable d'environnement SECRET_KEY est bien configurée sur Render).
SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure--@%$x)vo^63e7322ru0*7t=#5@!k$_bsb&)e-wlj2bdm-=7xla'
)

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# En production (DEBUG=False), ALLOWED_HOSTS doit lister précisément les
# domaines autorisés — configuré via la variable d'environnement
# ALLOWED_HOSTS (domaines séparés par des virgules), ex:
# "chariot-backend.onrender.com,127.0.0.1"
_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '')
if _allowed_hosts_env:
    ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = []


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Tiers
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Apps EDS
    'accounts',
    'catalog',
    'purchases',
    'library',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # Whitenoise sert les fichiers statiques (CSS/JS admin, etc.) directement
    # depuis Django en production, sans serveur web séparé — nécessaire sur
    # Render où il n'y a pas de Nginx/Apache devant l'app.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'chariot_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'chariot_backend.wsgi.application'


# --- Base de données ---
# Si la variable d'environnement DATABASE_URL est définie (ex: une base
# PostgreSQL fournie par Render), on l'utilise. Sinon on retombe sur
# SQLite, comme en local.
#
# ATTENTION (important à savoir) : sur le plan gratuit de Render, le
# système de fichiers d'un Web Service est éphémère — il est réinitialisé
# à chaque redéploiement/redémarrage. Si tu restes sur SQLite en
# production, la base de données (utilisateurs, achats...) sera donc
# remise à zéro à chaque déploiement. Pour des données persistantes en
# production, il faut créer une base PostgreSQL sur Render (le plan
# gratuit en propose une) et définir DATABASE_URL avec son URL de
# connexion.
_database_url = os.environ.get('DATABASE_URL')
if _database_url:
    DATABASES = {
        'default': dj_database_url.parse(_database_url, conn_max_age=600)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'accounts.Utilisateur'

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Douala'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- Django REST Framework ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),  # long, car lecture hors-ligne prolongée
}

# --- Email (development) ---
# In DEBUG mode, use the console backend so emails are printed to the runserver console.
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'no-reply@localhost'

# --- CORS ---
# En local (dev), le frontend React tourne sur un autre port. En
# production, on ajoute l'URL du frontend déployé (Netlify) via la
# variable d'environnement CORS_EXTRA_ORIGINS (domaines séparés par des
# virgules), pour ne pas avoir à modifier ce fichier à chaque changement
# de domaine.
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
]

_cors_extra = os.environ.get('CORS_EXTRA_ORIGINS', '')
if _cors_extra:
    CORS_ALLOWED_ORIGINS += [o.strip() for o in _cors_extra.split(',') if o.strip()]