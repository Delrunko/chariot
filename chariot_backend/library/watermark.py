import io
import fitz  # PyMuPDF


def generer_pdf_filigrane(chemin_fichier, nom_complet, telephone):
    """
    Ouvre le PDF source, applique un filigrane diagonal répété sur chaque
    page avec le nom et le numéro de l'acheteur, et renvoie le résultat
    sous forme de bytes en mémoire (rien n'est écrit sur le disque).
    """
    texte = f"{nom_complet} — {telephone}" if telephone else nom_complet

    doc = fitz.open(chemin_fichier)

    angle_degres = 45
    matrice_rotation = fitz.Matrix(angle_degres)

    for page in doc:
        rect = page.rect
        largeur, hauteur = rect.width, rect.height

        # Filigrane ajusté: police légèrement plus petite et moins opaque
        # pour être discret. Espacement augmenté pour réduire la densité.
        pas_x, pas_y = 420, 300
        y = 80
        while y < hauteur:
            x = 20
            while x < largeur:
                point_insertion = fitz.Point(x, y)
                page.insert_text(
                    point_insertion,
                    texte,
                    fontsize=12,
                    color=(0.65, 0.65, 0.65),
                    fill_opacity=0.18,
                    overlay=True,
                    morph=(point_insertion, matrice_rotation),
                )
                x += pas_x
            y += pas_y

    buffer = io.BytesIO()
    doc.save(buffer)
    doc.close()
    buffer.seek(0)
    return buffer