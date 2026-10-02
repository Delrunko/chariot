"""
Django settings for chariot_backend project.
"""
import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import unquote, urlparse

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv
import dj_database_url

# Import défensif de Cloudinary
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    _CLOUDINARY_AVAILABLE = True
except ImportError:
    _CLOUDINARY_AVAILABLE = False

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure--@%$x)vo^63e7322ru0*7t=#5@!k$_bsb&)e-wlj2bdm-=7xla'
)

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

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
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    *(['cloudinary', 'cloudinary_storage'] if _CLOUDINARY_AVAILABLE else []),
    'accounts',
    'catalog',
    'purchases',
    'library',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
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


def _cloudinary_config_from_env(environ):
    cloudinary_url = environ.get('CLOUDINARY_URL')
    url_config = {}
    if cloudinary_url:
        parsed_url = urlparse(cloudinary_url)
        if parsed_url.scheme != 'cloudinary' or not parsed_url.hostname:
            raise ImproperlyConfigured('CLOUDINARY_URL must be a valid cloudinary:// URL.')
        url_config = {
            'cloud_name': parsed_url.hostname,
            'api_key': unquote(parsed_url.username or ''),
            'api_secret': unquote(parsed_url.password or ''),
        }

    config = {
        'cloud_name': environ.get('CLOUDINARY_CLOUD_NAME') or url_config.get('cloud_name'),
        'api_key': environ.get('CLOUDINARY_API_KEY') or url_config.get('api_key'),
        'api_secret': environ.get('CLOUDINARY_API_SECRET') or url_config.get('api_secret'),
    }
    configured_values = [bool(value) for value in config.values()]
    if any(configured_values) and not all(configured_values):
        raise ImproperlyConfigured(
            'Configure CLOUDINARY_URL or all three CLOUDINARY_CLOUD_NAME, '
            'CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET variables.'
        )
    return config


_cloudinary_config = _cloudinary_config_from_env(os.environ)
_use_cloudinary = _CLOUDINARY_AVAILABLE and all(_cloudinary_config.values())
if _use_cloudinary:
    cloudinary.config(
        **_cloudinary_config,
        secure=True,
    )

STORAGES = {
    'default': {
        'BACKEND': 'catalog.storage.TypeAwareCloudinaryMediaStorage' if _use_cloudinary else 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticatedOrReadOnly',),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
}

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'no-reply@localhost'

# --- CONFIGURATION CORS & CSRF (CORRIGÉE) ---

# Liste des origines autorisées pour les requêtes cross-origin (Frontend -> Backend)
CORS_ALLOWED_ORIGINS = [
    'https://99853f1e.chariot-5p9.pages.dev',  # Nouveau site Cloudflare Pages
    'https://eds-doumbou.netlify.app',         # Ancien site Netlify (transition)
    'http://localhost:5173',                   # Développement local Vite
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
]

# Ajout dynamique via variable d'environnement si nécessaire
_cors_extra = os.environ.get('CORS_EXTRA_ORIGINS', '')
if _cors_extra:
    CORS_ALLOWED_ORIGINS += [o.strip() for o in _cors_extra.split(',') if o.strip()]

# Liste des origines autorisées pour les formulaires POST (Protection CSRF)
CSRF_TRUSTED_ORIGINS = [
    'https://99853f1e.chariot-5p9.pages.dev',  # Nouveau site Cloudflare Pages
    'https://eds-doumbou.netlify.app',         # Ancien site Netlify
    'https://chariot-backend-lmms.onrender.com', # Votre backend Render
]

# Ajout dynamique via variable d'environnement si nécessaire
_csrf_extra = os.environ.get('CSRF_EXTRA_ORIGINS', '')
if _csrf_extra:
    CSRF_TRUSTED_ORIGINS += [o.strip() for o in _csrf_extra.split(',') if o.strip()]