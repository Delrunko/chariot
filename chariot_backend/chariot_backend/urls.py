from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/purchases/", include("purchases.urls")),
    path("api/library/", include("library.urls")),
    path("api/", include("catalog.urls")),
]

# En développement (DEBUG=True), Django sert directement les fichiers
# médias via ce helper. En production (DEBUG=False, ex: sur Render),
# `static()` ne fait rien par défaut — il faut donc les servir nous-mêmes,
# peu importe DEBUG, sinon les images/PDF/vidéos uploadés (couvertures,
# documents Éloquence, etc.) renvoient une 404.
#
# Note : ce n'est pas la manière la plus performante de servir des fichiers
# médias en production (idéalement un stockage cloud comme S3/Cloudinary
# serait préférable), mais ça fonctionne correctement pour le volume de
# fichiers de ce projet et évite d'avoir à changer de service de stockage
# dans l'immédiat.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)