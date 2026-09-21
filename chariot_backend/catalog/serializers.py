from rest_framework import serializers
from .models import Categorie, SousCategorie, Livre, LivreImage, Testimonial, Service, ServiceImage, Quote


class SousCategorieSerializer(serializers.ModelSerializer):
    categorie = serializers.PrimaryKeyRelatedField(queryset=Categorie.objects.all(), required=True)

    class Meta:
        model = SousCategorie
        fields = ["id", "nom", "slug", "ordre", "categorie"]


class CategorieSerializer(serializers.ModelSerializer):
    sous_categories = SousCategorieSerializer(many=True, read_only=True)

    class Meta:
        model = Categorie
        fields = ["id", "nom", "slug", "description", "type_categorie", "ordre", "sous_categories"]


class LivreImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = LivreImage
        fields = ["id", "image", "ordre"]


class LivreListSerializer(serializers.ModelSerializer):
    """Utilisé pour le catalogue et la vitrine (liste) : léger, sans le fichier."""
    sous_categorie = serializers.StringRelatedField()
    categorie = serializers.CharField(source="sous_categorie.categorie.nom", read_only=True)
    type_categorie = serializers.CharField(source="sous_categorie.categorie.type_categorie", read_only=True)
    est_service = serializers.BooleanField(read_only=True)
    deja_achete = serializers.SerializerMethodField()

    class Meta:
        model = Livre
        fields = [
            "id", "titre", "slug", "prix", "couverture", "sous_categorie",
            "categorie", "type_categorie", "est_service", "mis_en_avant", "deja_achete",
        ]

    def get_deja_achete(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if obj.est_service:
            return False
        return obj.achats.filter(utilisateur=request.user, statut="paye").exists()


class LivreWriteSerializer(serializers.ModelSerializer):
    sous_categorie = serializers.PrimaryKeyRelatedField(queryset=SousCategorie.objects.all())
    fichier = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Livre
        fields = [
            "id",
            "titre",
            "slug",
            "description",
            "sous_categorie",
            "prix",
            "couverture",
            "fichier",
            "disponible",
            "mis_en_avant",
        ]
        read_only_fields = ["id", "slug"]


class LivreDetailSerializer(LivreListSerializer):
    images = LivreImageSerializer(many=True, read_only=True)

    class Meta(LivreListSerializer.Meta):
        fields = LivreListSerializer.Meta.fields + ["description", "disponible", "images"]
        # Le champ "fichier" n'est JAMAIS exposé ici : l'accès passe uniquement
        # par l'endpoint contrôlé de l'app `library`.
        # Pour un service, "fichier" n'existe simplement pas — la demande se fait via WhatsApp.


class TestimonialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Testimonial
        fields = ["id", "nom", "message", "rating", "approved", "date_created"]
        read_only_fields = ["id", "approved", "date_created"]


class ServiceImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceImage
        fields = ["id", "image", "ordre"]


class ServiceListSerializer(serializers.ModelSerializer):
    sous_categorie = serializers.StringRelatedField()
    categorie = serializers.CharField(source="sous_categorie.categorie.nom", read_only=True)
    type_categorie = serializers.CharField(source="sous_categorie.categorie.type_categorie", read_only=True)

    class Meta:
        model = Service
        fields = ["id", "titre", "slug", "prix", "couverture", "sous_categorie", "categorie", "type_categorie"]


class ServiceDetailSerializer(ServiceListSerializer):
    images = ServiceImageSerializer(many=True, read_only=True)
    document = serializers.SerializerMethodField()
    video = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()

    class Meta(ServiceListSerializer.Meta):
        fields = ServiceListSerializer.Meta.fields + ["description", "disponible", "images", "whatsapp_phone", "document", "video", "video_url"]

    def _has_paid(self, obj, request):
        # Admins always see document/video
        if request and getattr(request, 'user', None) and request.user.is_staff:
            return True
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        # Check if the user has a paid ServiceAchat for this service
        try:
            from purchases.models import ServiceAchat
            return ServiceAchat.objects.filter(utilisateur=user, service=obj, statut=ServiceAchat.Statut.PAYE).exists()
        except Exception:
            return False

    def get_document(self, obj):
        request = self.context.get('request')
        if self._has_paid(obj, request) and obj.document:
            return request.build_absolute_uri(obj.document.url) if request else obj.document.url
        return None

    def get_video(self, obj):
        request = self.context.get('request')
        if self._has_paid(obj, request) and obj.video:
            return request.build_absolute_uri(obj.video.url) if request else obj.video.url
        return None

    def get_video_url(self, obj):
        request = self.context.get('request')
        if self._has_paid(obj, request) and obj.video_url:
            return obj.video_url
        return None


class ServiceWriteSerializer(serializers.ModelSerializer):
    sous_categorie = serializers.PrimaryKeyRelatedField(queryset=SousCategorie.objects.all())

    class Meta:
        model = Service
        fields = ["id", "titre", "slug", "description", "sous_categorie", "prix", "couverture", "document", "video", "video_url", "disponible", "whatsapp_phone"]
        read_only_fields = ["id", "slug"]


# Serializer for Quote / Devis
class QuoteImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = getattr(__import__('catalog.models', fromlist=['QuoteImage']), 'QuoteImage')
        fields = ['id', 'image']


class QuoteSerializer(serializers.ModelSerializer):
    categorie = serializers.PrimaryKeyRelatedField(queryset=Categorie.objects.all(), required=False, allow_null=True)
    images = QuoteImageSerializer(many=True, read_only=True)

    class Meta:
        model = Quote
        fields = ["id", "client_name", "client_email", "client_phone", "message", "categorie", "items", "event_date", "address", "prix_estime", "images", "created_at", "pdf_file"]
        read_only_fields = ["id", "created_at", "pdf_file"]

