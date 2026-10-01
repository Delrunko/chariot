import logging

import requests
from django.db.models import OuterRef, Subquery
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse, Http404
from .models import AccesLecture
from .serializers import AccesLectureSerializer
from .watermark import generer_pdf_filigrane
from purchases.models import Achat

logger = logging.getLogger(__name__)


class MaBibliothequeView(generics.ListAPIView):
    """Liste des livres achetés, avec l'état de leur accès hors-ligne."""
    serializer_class = AccesLectureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        acces_utilisateur = AccesLecture.objects.filter(
            utilisateur=self.request.user,
            actif=True,
        )
        acces_le_plus_recent = acces_utilisateur.filter(
            livre_id=OuterRef("livre_id")
        ).order_by("-derniere_revalidation", "-pk")
        return (
            acces_utilisateur.filter(
                pk=Subquery(acces_le_plus_recent.values("pk")[:1])
            )
            .select_related("livre")
            .order_by("-derniere_revalidation", "-pk")
        )


class RevaliderAccesView(APIView):
    """
    Appelé par le frontend (PWA) lors d'une reconnexion pour prolonger
    la validité de la lecture hors-ligne, et enregistrer/mettre à jour
    l'empreinte de l'appareil utilisé.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, livre_id):
        empreinte = request.data.get("empreinte_appareil")
        if not empreinte:
            return Response({"detail": "empreinte_appareil requise"}, status=status.HTTP_400_BAD_REQUEST)

        if not Achat.objects.filter(utilisateur=request.user, livre_id=livre_id, statut=Achat.Statut.PAYE).exists():
            return Response({"detail": "Livre non acheté"}, status=status.HTTP_403_FORBIDDEN)

        acces, _ = AccesLecture.objects.get_or_create(
            utilisateur=request.user, livre_id=livre_id, empreinte_appareil=empreinte
        )
        acces.revalider()
        return Response(AccesLectureSerializer(acces).data)


class LireLivreView(APIView):
    """
    Sert le fichier du livre UNIQUEMENT si l'utilisateur possède un
    accès actif et valide pour l'appareil demandé. Ne renvoie jamais
    d'URL publique directe vers le fichier stocké — le PDF est filigrané
    à la volée avec le nom et le numéro de l'acheteur.

    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, livre_id):
        empreinte = request.query_params.get("empreinte_appareil")
        if not empreinte:
            return Response(
                {"detail": "empreinte_appareil requise"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        achat_paye = Achat.objects.filter(
            utilisateur=request.user,
            livre_id=livre_id,
            statut=Achat.Statut.PAYE,
        ).exists()
        if not achat_paye:
            raise Http404("Achat payé introuvable.")

        try:
            acces = AccesLecture.objects.select_related("livre").get(
                utilisateur=request.user, livre_id=livre_id, empreinte_appareil=empreinte, actif=True
            )
        except AccesLecture.DoesNotExist:
            acces, _ = AccesLecture.objects.get_or_create(
                utilisateur=request.user,
                livre_id=livre_id,
                empreinte_appareil=empreinte,
                defaults={"actif": True},
            )

        if not acces.actif:
            acces.revalider()

        if acces.doit_revalider:
            return Response(
                {"detail": "Revalidation en ligne requise avant de continuer la lecture."},
                status=status.HTTP_426_UPGRADE_REQUIRED,
            )

        utilisateur = request.user
        nom_complet = utilisateur.get_full_name() or utilisateur.username
        telephone = utilisateur.telephone or ""

        if not acces.livre.fichier:
            raise Http404("Fichier PDF introuvable.")

        try:
            fichier_livre = acces.livre.fichier
            with fichier_livre.open("rb") as fichier:
                contenu_pdf = fichier.read()
        except (OSError, requests.exceptions.RequestException):
            logger.exception(
                "Unable to retrieve purchased PDF (user=%s, book=%s, file=%s, storage=%s).",
                request.user.pk,
                livre_id,
                getattr(acces.livre.fichier, "name", ""),
                type(acces.livre.fichier.storage).__name__,
            )
            return Response(
                {
                    "detail": (
                        "Le PDF est absent ou stocké dans un format incompatible. "
                        "Demandez à l'administrateur de joindre à nouveau le fichier PDF original."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            pdf_filigrane = generer_pdf_filigrane(
                contenu_pdf, nom_complet, telephone
            )
        except (RuntimeError, ValueError):
            logger.exception(
                "Unable to watermark purchased PDF (user=%s, book=%s).",
                request.user.pk,
                livre_id,
            )
            return Response(
                {"detail": "Le fichier PDF est invalide ou ne peut pas être préparé."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        return FileResponse(
            pdf_filigrane,
            filename=acces.livre.fichier.name,
            content_type="application/pdf",
        )