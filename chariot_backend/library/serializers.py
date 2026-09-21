from rest_framework import serializers
from .models import AccesLecture
from catalog.serializers import LivreListSerializer


class AccesLectureSerializer(serializers.ModelSerializer):
    livre = LivreListSerializer(read_only=True)

    class Meta:
        model = AccesLecture
        fields = ["id", "livre", "jeton", "derniere_revalidation", "doit_revalider", "actif"]
