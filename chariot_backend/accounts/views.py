from rest_framework import generics, permissions
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Categorie, Livre, SousCategorie
from purchases.models import Achat
from .models import Utilisateur
from .serializers import AdminUserSerializer, InscriptionSerializer, UtilisateurSerializer


class InscriptionView(generics.CreateAPIView):
    queryset = Utilisateur.objects.all()
    serializer_class = InscriptionSerializer
    permission_classes = [permissions.AllowAny]


class ProfilView(generics.RetrieveAPIView):
    serializer_class = UtilisateurSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class AdminDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "est_admin", False):
            raise PermissionDenied("Accès réservé à l'administrateur.")

        stats = {
            "total_categories": Categorie.objects.count(),
            "total_sous_categories": SousCategorie.objects.count(),
            "total_livres": Livre.objects.count(),
            "total_achats": Achat.objects.filter(statut=Achat.Statut.PAYE).count(),
            "total_utilisateurs": Utilisateur.objects.count(),
        }

        recent_livres = list(
            Livre.objects.select_related("sous_categorie__categorie")
            .order_by("-date_ajout")[:8]
            .values(
                "id",
                "titre",
                "slug",
                "prix",
                "disponible",
                "mis_en_avant",
                "sous_categorie__nom",
                "sous_categorie__categorie__nom",
            )
        )

        # Recent book purchases
        recent_book_achats = list(
            Achat.objects.select_related("utilisateur", "livre")
            .order_by("-date_achat")[:8]
            .values(
                "id",
                "utilisateur__username",
                "livre__titre",
                "montant",
                "statut",
                "date_achat",
            )
        )

        # Recent service purchases (Éloquence)
        from purchases.models import ServiceAchat
        recent_service_achats = list(
            ServiceAchat.objects.select_related("utilisateur", "service")
            .order_by("-date_achat")[:8]
            .values(
                "id",
                "utilisateur__username",
                "service__titre",
                "montant",
                "statut",
                "date_achat",
            )
        )

        # Normalize entries into a single recent_achats list with a type field
        recent_achats = []
        for a in recent_book_achats:
            recent_achats.append({
                "id": a["id"],
                "type": "livre",
                "titre": a.get("livre__titre"),
                "utilisateur__username": a.get("utilisateur__username"),
                "montant": a.get("montant"),
                "statut": a.get("statut"),
                "date_achat": a.get("date_achat"),
            })
        for s in recent_service_achats:
            recent_achats.append({
                "id": s["id"],
                "type": "service",
                "titre": s.get("service_titre") if "service_titre" in s else s.get("service__titre"),
                "utilisateur__username": s.get("utilisateur__username"),
                "montant": s.get("montant"),
                "statut": s.get("statut"),
                "date_achat": s.get("date_achat"),
            })

        # Sort by date_achat desc and limit to 8
        recent_achats = sorted(recent_achats, key=lambda x: x.get("date_achat") or "", reverse=True)[:8]

        # Update total_achats to include both book and service purchases paid
        total_book_paye = Achat.objects.filter(statut=Achat.Statut.PAYE).count()
        total_service_paye = ServiceAchat.objects.filter(statut=ServiceAchat.Statut.PAYE).count()
        stats["total_achats"] = total_book_paye + total_service_paye

        return Response({
            "stats": stats,
            "recent_livres": recent_livres,
            "recent_achats": recent_achats,
        })


class AdminUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "est_admin", False):
            raise PermissionDenied("Accès réservé à l'administrateur.")

        users = Utilisateur.objects.order_by("-date_joined")
        serializer = AdminUserSerializer(users, many=True)
        return Response(serializer.data)


# --- Endpoint TEMPORAIRE pour créer le superuser admin ---
@api_view(['GET'])
def create_admin_temp(request):
    """À supprimer après avoir créé le compte admin"""
    try:
        username = 'admin'
        email = 'admin@eds-doumbou.com'
        password = 'AdminEDS2026!'
        
        user = Utilisateur.objects.filter(username=username).first()
        
        if user:
            user.is_superuser = True
            user.is_staff = True
            user.role = Utilisateur.Role.ADMIN  # C'est ici qu'il faut agir sur le rôle
            user.set_password(password)
            user.save()
            return Response({
                'message': f"Compte '{username}' mis à jour en admin.",
                'username': username,
                'password': password
            })
        
        user = Utilisateur.objects.create_superuser(
            username=username,
            email=email,
            password=password
        )
        user.role = Utilisateur.Role.ADMIN
        user.save()
        
        return Response({
            'message': "Superuser admin créé avec succès !",
            'username': username,
            'password': password
        })
    except Exception as e:
        return Response({
            'error': str(e),
            'type': type(e).__name__
        }, status=500)