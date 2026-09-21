from django.urls import path
from django.urls import path
from .views import AchatCreateView, AdminAchatsListView, AdminAchatUpdateView, MesAchatsView, PaymentConfigView
from .service_views import (
    ServiceAchatCreateView,
    MesServiceAchatsView,
    AdminServiceAchatsListView,
    AdminServiceAchatUpdateView,
)

urlpatterns = [
    # Book purchases
    path("", AchatCreateView.as_view(), name="achat-create"),
    path("mes-achats/", MesAchatsView.as_view(), name="mes-achats"),
    path("admin/", AdminAchatsListView.as_view(), name="admin-achats"),
    path("admin/<int:id>/", AdminAchatUpdateView.as_view(), name="admin-achat-update"),
    path("admin/payment-settings/", PaymentConfigView.as_view(), name="payment-settings"),

    # Service (Éloquence) purchases — align behaviour with books
    path("service/", ServiceAchatCreateView.as_view(), name="service-achat-create"),
    path("service/mes-achats/", MesServiceAchatsView.as_view(), name="mes-service-achats"),
    path("admin/service/", AdminServiceAchatsListView.as_view(), name="admin-service-achats"),
    path("admin/service/<int:id>/", AdminServiceAchatUpdateView.as_view(), name="admin-service-achat-update"),
]
