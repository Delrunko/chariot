from django.urls import path
from .views import MaBibliothequeView, RevaliderAccesView, LireLivreView

urlpatterns = [
    path("", MaBibliothequeView.as_view(), name="ma-bibliotheque"),
    path("<int:livre_id>/revalider/", RevaliderAccesView.as_view(), name="revalider-acces"),
    path("<int:livre_id>/read/", LireLivreView.as_view(), name="lire-livre"),
]
