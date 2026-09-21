from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from .models import Achat, PaymentConfig, ServiceAchat
from .serializers import AchatAdminSerializer, AchatSerializer, PaymentConfigSerializer, ServiceAchatSerializer, ServiceAchatAdminSerializer
from library.models import AccesLecture


class AchatCreateView(generics.CreateAPIView):
    """
    Initie un achat. Le montant est repris du livre (jamais du client,
    pour éviter toute manipulation du prix côté frontend).

    NOTE INTÉGRATION : ici on simule un paiement immédiatement validé.
    En production, brancher l'agrégateur Orange Money (CamPay / Notch Pay
    ou API Orange Money directe) : créer l'achat en `en_attente`, rediriger
    l'utilisateur vers Orange Money, puis valider via webhook avant de
    passer le statut à `paye` et créer l'AccesLecture.
    """
    serializer_class = AchatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        livre = serializer.validated_data["livre"]
        # Create the achat in 'en_attente' state. The real payment/confirmation
        # with Orange Money should update this via webhook or admin action.
        ref = serializer.validated_data.get("reference_transaction", "")
        moyen = serializer.validated_data.get("moyen_paiement", Achat.MoyenPaiement.ORANGE_MONEY)
        achat = serializer.save(
            utilisateur=self.request.user,
            montant=livre.prix,
            statut=Achat.Statut.EN_ATTENTE,
            moyen_paiement=moyen,
            reference_transaction=ref,
        )
        # Do NOT create AccesLecture here: wait for payment confirmation (admin/webhook).
        return achat


class MesAchatsView(generics.ListAPIView):
    serializer_class = AchatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Achat.objects.filter(utilisateur=self.request.user, statut=Achat.Statut.PAYE)


class AdminAchatsListView(generics.ListAPIView):
    serializer_class = AchatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not getattr(user, "est_admin", False):
            raise PermissionDenied("Accès réservé à l'administrateur.")
        return Achat.objects.select_related("utilisateur", "livre").order_by("-date_achat")


class AdminAchatUpdateView(generics.UpdateAPIView):
    serializer_class = AchatAdminSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"
    queryset = Achat.objects.all()

    def update(self, request, *args, **kwargs):
        if not getattr(request.user, "est_admin", False):
            raise PermissionDenied("Accès réservé à l'administrateur.")

        # Perform the update and, if the statut is changed to PAYE, ensure
        # an AccesLecture object exists and record the payment date.
        achat = self.get_object()
        previous_statut = achat.statut

        response = super().update(request, *args, **kwargs)

        # Reload the instance to see applied changes
        achat.refresh_from_db()

        if previous_statut != achat.statut and achat.statut == Achat.Statut.PAYE:
            # mark payment date if not already set
            if not achat.date_paiement:
                achat.date_paiement = timezone.now()
                achat.save(update_fields=["date_paiement"])

            # create lecture access if missing
            AccesLecture.objects.get_or_create(
                utilisateur=achat.utilisateur,
                livre=achat.livre,
                defaults={"empreinte_appareil": "en_attente_admin_approbation"},
            )

        # Cas inverse : l'achat n'est plus PAYE (rejeté, remis en attente,
        # etc. par l'admin). Tout accès de lecture existant pour ce livre
        # et cet utilisateur doit être révoqué, sinon la personne garde
        # la possibilité de lire le livre malgré le rejet de son achat.
        elif previous_statut != achat.statut and achat.statut != Achat.Statut.PAYE:
            AccesLecture.objects.filter(
                utilisateur=achat.utilisateur,
                livre=achat.livre,
            ).update(actif=False)

        return response


class PaymentConfigView(generics.RetrieveUpdateAPIView):
    """Get or update the PaymentConfig singleton used to render USSD codes.

    Only admins can update; any authenticated user can read (but we will restrict to admin in this use).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentConfigSerializer

    def get_object(self):
        # Ensure a singleton exists
        obj, _ = PaymentConfig.objects.get_or_create(id=1)
        return obj

    def update(self, request, *args, **kwargs):
        if not getattr(request.user, "est_admin", False):
            raise PermissionDenied("Accès réservé à l'administrateur.")
        return super().update(request, *args, **kwargs)