from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Utilisateur


class InscriptionSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = Utilisateur
        fields = ["id", "username", "email", "telephone", "password"]

    def create(self, validated_data):
        return Utilisateur.objects.create_user(role=Utilisateur.Role.CLIENT, **validated_data)


class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ["id", "username", "email", "telephone", "role"]


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "email",
            "telephone",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
        ]
