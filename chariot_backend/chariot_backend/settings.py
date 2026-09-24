"""
Django settings for chariot_backend project.
"""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

# Import défensif de Cloudinary : si le paquet n'est pas encore installé
# (ex: en local avant un `pip install`), on ne fait pas planter le démarrage.
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    _CLOUDINARY_AVAILABLE = True
except ImportError:
    _CLOUDINARY_AVAILABLE = False

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Sécurité : plus jamais de clé en dur dans le code une fois publié ---
SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure--@%$x)vo^63e7322ru0*7t=#5@!k$_bsb&)e-wlj2bdm-=7xla'
)

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# --- Hôtes autorisés ---
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

    # Stockage Cloudinary (uniquement si le paquet est présent)
    *(['cloudinary', 'cloudinary_storage'] if _CLOUDINARY_AVAILABLE else []),

    # Apps EDS
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


# --- Base de données ---
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

# --- Stockage des médias ---
# En production (variables Cloudinary présentes) => images sur le cloud,
# donc persistantes malgré le redéploiement Render.
# En local (variables absentes) => stockage disque classique, inchangé.
_use_cloudinary = _CLOUDINARY_AVAILABLE and bool(os.environ.get('CLOUDINARY_CLOUD_NAME'))

if _use_cloudinary:
    cloudinary.config(
        cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
        api_key=os.environ.get('CLOUDINARY_API_KEY'),
        api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
        secure=True,
    )

STORAGES = {
    'default': {
        'BACKEND': (
            'cloudinary_storage.storage.MediaCloudinaryStorage'
            if _use_cloudinary
            else 'django.core.files.storage.FileSystemStorage'
        ),
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
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
}

# --- Email (development) ---
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'no-reply@localhost'

# --- CORS ---
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
]

_cors_extra = os.environ.get('CORS_EXTRA_ORIGINS', '')
if _cors_extra:
    CORS_ALLOWED_ORIGINS += [o.strip() for o in _cors_extra.split(',') if o.strip()]

# --- CSRF (indispensable pour que POST /auth/login/ depuis Netlify passe) ---
# Sans ce bloc, Django renvoie 403 « Origin checking failed » sur toute
# requête d'écriture venant d'un autre domaine HTTPS. C'est la cause
# actuelle de l'échec de connexion, même avec la bonne URL côté React.
CSRF_TRUSTED_ORIGINS = [
    'https://eds-doumbou.netlify.app',
    'https://chariot-backend-lmms.onrender.com',
]

_csrf_extra = os.environ.get('CSRF_EXTRA_ORIGINS', '')
if _csrf_extra:
    CSRF_TRUSTED_ORIGINS += [o.strip() for o in _csrf_extra.split(',') if o.strip()]