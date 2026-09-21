from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import ServiceAchat, Achat
from .serializers import ServiceAchatSerializer, ServiceAchatAdminSerializer


class ServiceAchatCreateView(generics.CreateAPIView):
    """Create a purchase record for a Service (Éloquence).

    The amount is taken from the Service.price on the server side to prevent
    client-side tampering. The purchase is created in 'en_attente' state —
    admin or a payment webhook must later mark it 'paye'.
    """
    serializer_class = ServiceAchatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        service = serializer.validated_data["service"]
        ref = serializer.validated_data.get("reference_transaction", "")
        moyen = serializer.validated_data.get("moyen_paiement", Achat.MoyenPaiement.ORANGE_MONEY)

        achat, created = ServiceAchat.objects.get_or_create(
            utilisateur=self.request.user,
            service=service,
            defaults={
                "montant": service.prix,
                "statut": ServiceAchat.Statut.EN_ATTENTE,
                "moyen_paiement": moyen,
                "reference_transaction": ref,
            },
        )

        if not created:
            if achat.statut == ServiceAchat.Statut.PAYE:
                raise ValidationError("Ce service a déjà été payé et validé.")
            achat.montant = service.prix
            achat.statut = ServiceAchat.Statut.EN_ATTENTE
            achat.moyen_paiement = moyen
            achat.reference_transaction = ref
            achat.date_paiement = None
            achat.save(update_fields=["montant", "statut", "moyen_paiement", "reference_transaction", "date_paiement"])

        serializer.instance = achat
        return achat


class MesServiceAchatsView(generics.ListAPIView):
    serializer_class = ServiceAchatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ServiceAchat.objects.filter(utilisateur=self.request.user, statut=ServiceAchat.Statut.PAYE)


class AdminServiceAchatsListView(generics.ListAPIView):
    serializer_class = ServiceAchatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not getattr(user, "est_admin", False):
            raise PermissionDenied("Accès réservé à l'administrateur.")
        return ServiceAchat.objects.select_related("utilisateur", "service").order_by("-date_achat")


class AdminServiceAchatUpdateView(generics.UpdateAPIView):
    serializer_class = ServiceAchatAdminSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"
    queryset = ServiceAchat.objects.all()

    def update(self, request, *args, **kwargs):
        if not getattr(request.user, "est_admin", False):
            raise PermissionDenied("Accès réservé à l'administrateur.")

        achat = self.get_object()
        previous_statut = achat.statut

        response = super().update(request, *args, **kwargs)

        achat.refresh_from_db()

        if previous_statut != achat.statut and achat.statut == ServiceAchat.Statut.PAYE:
            if not achat.date_paiement:
                achat.date_paiement = timezone.now()
                achat.save(update_fields=["date_paiement"])
            # No separate AccesLecture object for services — the ServiceDetailSerializer
            # reads ServiceAchat to determine access. Marking PAYE is sufficient.

        return response
