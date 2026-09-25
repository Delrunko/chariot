from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import AdminDashboardView, AdminUsersView, InscriptionView, ProfilView, create_admin_temp

urlpatterns = [
    path("register/", InscriptionView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("login/refresh/", TokenRefreshView.as_view(), name="login-refresh"),
    path("me/", ProfilView.as_view(), name="profil"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/users/", AdminUsersView.as_view(), name="admin-users"),
    path("create-admin-temp/", create_admin_temp, name="create-admin-temp"),
]