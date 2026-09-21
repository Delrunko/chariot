from rest_framework import serializers
from .models import Achat


class AchatSerializer(serializers.ModelSerializer):
    livre_titre = serializers.CharField(source="livre.titre", read_only=True)
    utilisateur_username = serializers.CharField(source="utilisateur.username", read_only=True)

    class Meta:
        model = Achat
        fields = [
            "id",
            "livre",
            "livre_titre",
            "utilisateur",
            "utilisateur_username",
            "moyen_paiement",
            "statut",
            "montant",
            "reference_transaction",
            "date_achat",
        ]
        # Allow clients to supply a reference_transaction at creation (e.g. their payment ref)
        # utilisateur must be set by the server (request.user) — clients should not provide it
        read_only_fields = ["montant", "date_achat", "utilisateur"]


class AchatAdminSerializer(AchatSerializer):
    class Meta(AchatSerializer.Meta):
        # admin cannot change montant or date_achat, but can set statut and reference_transaction
        read_only_fields = ["montant", "date_achat", "livre", "livre_titre", "utilisateur_username"]


from rest_framework import serializers as _serializers
from .models import PaymentConfig, ServiceAchat

class PaymentConfigSerializer(_serializers.ModelSerializer):
    class Meta:
        model = PaymentConfig
        fields = ['id', 'merchant_code', 'merchant_number']
        read_only_fields = []


class ServiceAchatSerializer(_serializers.ModelSerializer):
    service_titre = serializers.CharField(source="service.titre", read_only=True)
    utilisateur_username = serializers.CharField(source="utilisateur.username", read_only=True)

    class Meta:
        model = ServiceAchat
        fields = [
            "id",
            "service",
            "service_titre",
            "utilisateur",
            "utilisateur_username",
            "moyen_paiement",
            "statut",
            "montant",
            "reference_transaction",
            "date_achat",
        ]
        read_only_fields = ["montant", "date_achat", "utilisateur"]


class ServiceAchatAdminSerializer(ServiceAchatSerializer):
    class Meta(ServiceAchatSerializer.Meta):
        read_only_fields = ["montant", "date_achat", "service", "service_titre", "utilisateur_username"]
