from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse, Http404
from .models import AccesLecture
from .serializers import AccesLectureSerializer
from .watermark import generer_pdf_filigrane
from purchases.models import Achat


class MaBibliothequeView(generics.ListAPIView):
    """Liste des livres achetés, avec l'état de leur accès hors-ligne."""
    serializer_class = AccesLectureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AccesLecture.objects.filter(utilisateur=self.request.user, actif=True).select_related("livre")


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

    NOTE TEMPORAIRE : le try/except autour de generer_pdf_filigrane a été
    retiré pour laisser l'erreur remonter et voir la traceback complète
    dans le terminal Django. Une fois le bug identifié et corrigé, on
    pourra remettre un except plus ciblé si besoin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, livre_id):
        empreinte = request.query_params.get("empreinte_appareil")
        try:
            acces = AccesLecture.objects.select_related("livre").get(
                utilisateur=request.user, livre_id=livre_id, empreinte_appareil=empreinte, actif=True
            )
        except AccesLecture.DoesNotExist:
            raise Http404("Accès non trouvé ou révoqué.")

        if acces.doit_revalider:
            return Response(
                {"detail": "Revalidation en ligne requise avant de continuer la lecture."},
                status=status.HTTP_426_UPGRADE_REQUIRED,
            )

        utilisateur = request.user
        nom_complet = utilisateur.get_full_name() or utilisateur.username
        telephone = utilisateur.telephone or ""

        pdf_filigrane = generer_pdf_filigrane(
            acces.livre.fichier.path, nom_complet, telephone
        )

        return FileResponse(
            pdf_filigrane,
            filename=acces.livre.fichier.name,
            content_type="application/pdf",
        )